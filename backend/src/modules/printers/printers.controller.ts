import { Response, NextFunction } from 'express';
import { printersService, CreatePrinterData, UpdatePrinterData, PrintTicketData, PrinterModule } from './printers.service';
import { AuthRequest } from '../../common/middleware';

export class PrintersController {

  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const printers = await printersService.findAll(req.user!.tenantId!);
      res.json({ success: true, data: printers });
    } catch (error) { next(error); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const printer = await printersService.findById(req.params.id, req.user!.tenantId!);
      res.json({ success: true, data: printer });
    } catch (error) { next(error); }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreatePrinterData = {
        name: req.body.name,
        connectionType: req.body.connectionType,
        ip: req.body.ip,
        port: req.body.port,
        paperWidth: req.body.paperWidth,
        assignedModule: req.body.assignedModule,
        deviceName: req.body.deviceName,
      };
      const printer = await printersService.create(req.user!.tenantId!, data);
      res.status(201).json({ success: true, data: printer });
    } catch (error) { next(error); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: UpdatePrinterData = {};
      if (req.body.name !== undefined)           data.name = req.body.name;
      if (req.body.connectionType !== undefined) data.connectionType = req.body.connectionType;
      if (req.body.ip !== undefined)             data.ip = req.body.ip;
      if (req.body.port !== undefined)           data.port = req.body.port;
      if (req.body.paperWidth !== undefined)     data.paperWidth = req.body.paperWidth;
      if (req.body.isActive !== undefined)       data.isActive = req.body.isActive;
      if ('assignedModule' in req.body)          data.assignedModule = req.body.assignedModule;
      if ('deviceName' in req.body)             data.deviceName = req.body.deviceName;

      const printer = await printersService.update(req.params.id, req.user!.tenantId!, data);
      res.json({ success: true, data: printer });
    } catch (error) { next(error); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await printersService.delete(req.params.id, req.user!.tenantId!);
      res.json({ success: true, message: 'Impresora eliminada' });
    } catch (error) { next(error); }
  }

  async testPrint(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await printersService.testPrint(req.params.id, req.user!.tenantId!);
      res.json({ success: true, ...result });
    } catch (error) { next(error); }
  }

  async printTicket(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: PrintTicketData = req.body.ticket;
      const result = await printersService.printTicket(req.params.id, req.user!.tenantId!, data);
      res.json({ success: true, ...result });
    } catch (error) { next(error); }
  }

  async printTicketByModule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const module = req.params.module as PrinterModule;
      const data: PrintTicketData = req.body.ticket;
      const result = await printersService.printTicketByModule(module, req.user!.tenantId!, data);
      res.json({ success: true, ...result });
    } catch (error) { next(error); }
  }
}

export const printersController = new PrintersController();
