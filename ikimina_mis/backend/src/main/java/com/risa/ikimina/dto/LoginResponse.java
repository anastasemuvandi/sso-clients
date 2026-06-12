package com.risa.ikimina.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

/**
 * Returned by the password step of login. 2FA is always on, so a successful
 * password check never yields a token directly — it tells the client a code
 * has been emailed and to collect it via the verify-2fa endpoint.
 */
@Data
@Builder
@AllArgsConstructor
public class LoginResponse {
    private boolean twoFactorRequired;
    private String email;
    private String message;
}
