import { useState } from "react";
import { LoginScreen } from "./LoginScreen.jsx";
import { SignupScreen } from "./SignupScreen.jsx";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen.jsx";
import { ResetPasswordScreen } from "./ResetPasswordScreen.jsx";
import { AcceptInviteScreen } from "./AcceptInviteScreen.jsx";

// Everything shown while logged out. A password-reset link (?reset_token=...
// from the email sent by /forgot-password) or an invite link
// (?invite_token=... generated in Settings → Members) always wins over
// whatever mode was last selected, since the user just clicked in from
// their inbox/the link they were sent. reset_token wins if somehow both are
// present (can't happen in practice — they come from different flows).
export function AuthScreens() {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get("reset_token");
  const inviteToken = params.get("invite_token");
  const wantsSignup = params.get("signup") === "1";
  const [mode, setMode] = useState(
    resetToken ? "reset" : inviteToken ? "invite" : wantsSignup ? "signup" : "login"
  );

  if (resetToken && mode === "reset") {
    return <ResetPasswordScreen token={resetToken} onDone={() => setMode("login")} />;
  }
  if (inviteToken && mode === "invite") {
    return (
      <AcceptInviteScreen
        token={inviteToken}
        onDone={() => setMode("login")}
        onBack={() => setMode("login")}
      />
    );
  }
  if (mode === "signup") return <SignupScreen onBack={() => setMode("login")} />;
  if (mode === "forgot") return <ForgotPasswordScreen onBack={() => setMode("login")} />;
  return <LoginScreen onSignup={() => setMode("signup")} onForgot={() => setMode("forgot")} />;
}
