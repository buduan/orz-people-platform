export interface LoginPathState {
  emailMfaEnabled: boolean;
  hasPassword: boolean;
  passkeyCount: number;
  smsMfaEnabled: boolean;
  totpEnabled: boolean;
}

export function hasViableLoginPath(state: LoginPathState): boolean {
  const hasMfa = state.emailMfaEnabled || state.smsMfaEnabled || state.totpEnabled;
  if (!hasMfa) return true;
  if (state.hasPassword || state.passkeyCount > 0) return true;
  return state.smsMfaEnabled || state.totpEnabled;
}
