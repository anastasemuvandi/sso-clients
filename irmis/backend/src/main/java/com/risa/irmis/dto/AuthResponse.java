package com.risa.irmis.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

/** Returned on a successful login (and SSO sign-in): the app JWT plus display fields. */
@Data
@Builder
@AllArgsConstructor
public class AuthResponse {
    private String token;
    private String email;
    private String fullName;
    private String role;
}
