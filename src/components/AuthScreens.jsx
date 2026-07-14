import { useState } from "react";
import { LoginScreen } from "./LoginScreen.jsx";
import { SignupScreen } from "./SignupScreen.jsx";
import { ForgotPasswordScreen } from "./ForgotPasswordScreen.jsx";
import { ResetPasswordScreen } from "./ResetPasswordScreen.jsx";

// Everything shown while logged out. A password-reset link (?reset_token=...
// from the email sent by /forgot-password) always wins over whatever mode
// was last selected, since the user just clicked in from their inbox.
export function AuthScreens() {
  const resetToken = new URLSearchParams(window.location.search).get("reset_token");
  const [mode, setMode] = useState(resetToken ? "reset" : "login");

  if (resetToken && mode === "reset") {
    return <ResetPasswordScreen token={resetToken} onDone={() => setMode("login")} />;
  }
  if (mode === "signup") return <SignupScreen onBack={() => setMode("login")} />;
  if (mode === "forgot") return <ForgotPasswordScreen onBack={() => setMode("login")} />;
  return <LoginScreen onSignup={() => setMode("signup")} onForgot={() => setMode("forgot")} />;
}
