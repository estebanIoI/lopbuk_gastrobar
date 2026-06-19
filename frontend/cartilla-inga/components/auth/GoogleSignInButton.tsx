import React from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => void;
  onError: () => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onSuccess,
  onError,
  text = 'continue_with'
}) => {
  const handleSuccess = (response: CredentialResponse) => {
    if (response.credential) {
      onSuccess(response.credential);
    } else {
      onError();
    }
  };

  return (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={onError}
        text={text}
        shape="rectangular"
        theme="outline"
        size="large"
      />
    </div>
  );
};
