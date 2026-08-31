"use client";

import { GoogleLogin } from "@react-oauth/google";
import { googleOAuthEnabled } from "./GoogleOAuthProvider";

export function GoogleSignInButton({
  disabled,
  onToken,
  onError,
}: {
  disabled?: boolean;
  onToken: (token: string) => void;
  onError: (message: string) => void;
}) {
  if (!googleOAuthEnabled()) return null;
  return (
    <div className={disabled ? "google-signin disabled" : "google-signin"}>
      <GoogleLogin
        onSuccess={(response) => {
          if (response.credential) onToken(response.credential);
          else onError("Google did not return an identity token. Try again.");
        }}
        onError={() =>
          onError("Google sign-in was cancelled or could not start.")
        }
        useOneTap={false}
        theme="outline"
        size="large"
        width="360"
      />
    </div>
  );
}
