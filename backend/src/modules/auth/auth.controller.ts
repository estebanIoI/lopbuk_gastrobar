import { Request, Response, NextFunction } from 'express';
import { authService, loginRateLimiter } from './auth.service';
import { AuthRequest } from '../../common/middleware';
import { audit } from '../../utils/audit-logger';

// Cookie options for httpOnly auth token
const COOKIE_NAME = 'authToken';
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24h in ms (matches JWT_EXPIRES_IN)
  path: '/',
};

function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { email, password } = req.body;

    // Check if this email is currently locked out
    const locked = loginRateLimiter.checkLocked(email);
    if (locked) {
      const minutesLeft = Math.ceil((locked.lockedUntil - Date.now()) / 60000);
      res.status(429).json({
        success: false,
        error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutesLeft} minuto${minutesLeft !== 1 ? 's' : ''}.`,
        lockedUntil: locked.lockedUntil,
      });
      return;
    }

    try {
      const result = await authService.login(email, password);

      loginRateLimiter.reset(email);
      setAuthCookie(res, result.token);
      audit.loginSuccess(result.user.id as string, (result.user as any).tenantId ?? null, req.ip);

      res.json({
        success: true,
        data: result,
        message: 'Inicio de sesion exitoso',
      });
    } catch (error) {
      audit.loginFailure(req.body.email, req.ip, (error as any)?.message);
      const failInfo = loginRateLimiter.recordFailure(email);
      const statusCode = (error as any)?.statusCode || 401;
      res.status(statusCode).json({
        success: false,
        error: (error as any)?.message || 'Error al iniciar sesión',
        ...(failInfo.attemptsLeft !== null && { attemptsLeft: failInfo.attemptsLeft }),
        ...(failInfo.lockedUntil && { lockedUntil: failInfo.lockedUntil }),
      });
    }
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // SEGURIDAD (F1): NUNCA se toma tenantId del body (era inyectable → cross-tenant).
      // El servicio decide el tenant de forma segura. 'superadmin' ya está bloqueado en el validador.
      const { email, password, name, role } = req.body;
      const result = await authService.register(email, password, name, role);

      setAuthCookie(res, result.token);
      audit.register(result.user.id as string, (result.user as any).tenantId ?? null, role ?? 'vendedor', req.ip);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Usuario registrado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async registerClient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name, phone, storeSlug,
              cedula, department, municipality, address, neighborhood } = req.body;
      const result = await authService.registerClient(
        email, password, name, phone, storeSlug || undefined,
        { cedula, department, municipality, address, neighborhood }
      );

      setAuthCookie(res, result.token);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Cuenta de cliente creada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { credential, storeSlug } = req.body;
      const result = await authService.googleLogin(credential, storeSlug || undefined);

      setAuthCookie(res, result.token);

      res.json({
        success: true,
        data: result,
        message: 'Inicio de sesion con Google exitoso',
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.authToken;
    // Optionally decode userId from token for audit (no DB call needed)
    if (token) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.decode(token) as any;
        if (decoded?.userId) audit.logout(decoded.userId, req.ip);
      } catch { /* ignore */ }
    }
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.json({ success: true, message: 'Sesion cerrada' });
  }

  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getProfile(req.user!.userId);

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, avatar, phone, cedula, department, municipality, address, neighborhood, deliveryLatitude, deliveryLongitude } = req.body;
      const user = await authService.updateProfile(req.user!.userId, {
        name, avatar, phone, cedula, department, municipality, address, neighborhood,
        deliveryLatitude: deliveryLatitude != null ? Number(deliveryLatitude) : undefined,
        deliveryLongitude: deliveryLongitude != null ? Number(deliveryLongitude) : undefined,
      });

      res.json({
        success: true,
        data: user,
        message: 'Perfil actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }

  async getAddresses(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const addresses = await authService.getUserAddresses(req.user!.userId);
      res.json({ success: true, data: addresses });
    } catch (error) { next(error); }
  }

  async addAddress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { label, department, municipality, address, neighborhood, deliveryLatitude, deliveryLongitude, isDefault } = req.body;
      const addresses = await authService.addUserAddress(req.user!.userId, {
        label, department, municipality, address, neighborhood,
        deliveryLatitude: deliveryLatitude != null ? Number(deliveryLatitude) : undefined,
        deliveryLongitude: deliveryLongitude != null ? Number(deliveryLongitude) : undefined,
        isDefault: !!isDefault,
      });
      res.status(201).json({ success: true, data: addresses, message: 'Dirección guardada' });
    } catch (error) { next(error); }
  }

  async updateAddress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { label, department, municipality, address, neighborhood, deliveryLatitude, deliveryLongitude, isDefault } = req.body;
      const addresses = await authService.updateUserAddress(req.user!.userId, req.params.id, {
        label, department, municipality, address, neighborhood,
        deliveryLatitude: deliveryLatitude != null ? Number(deliveryLatitude) : undefined,
        deliveryLongitude: deliveryLongitude != null ? Number(deliveryLongitude) : undefined,
        isDefault: isDefault !== undefined ? !!isDefault : undefined,
      });
      res.json({ success: true, data: addresses, message: 'Dirección actualizada' });
    } catch (error) { next(error); }
  }

  async deleteAddress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const addresses = await authService.deleteUserAddress(req.user!.userId, req.params.id);
      res.json({ success: true, data: addresses, message: 'Dirección eliminada' });
    } catch (error) { next(error); }
  }

  async setDefaultAddress(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const addresses = await authService.setDefaultUserAddress(req.user!.userId, req.params.id);
      res.json({ success: true, data: addresses, message: 'Dirección predeterminada actualizada' });
    } catch (error) { next(error); }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user!.userId, currentPassword, newPassword);
      audit.passwordChange(req.user!.userId, req.ip);

      res.json({
        success: true,
        message: 'Contrasena actualizada exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
