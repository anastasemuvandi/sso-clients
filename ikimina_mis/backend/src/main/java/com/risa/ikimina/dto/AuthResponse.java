package com.risa.ikimina.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

/** Returned once login is fully complete (after the 2FA code is verified). */
@Data
@Builder
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String email;
    private String fullName;
}
