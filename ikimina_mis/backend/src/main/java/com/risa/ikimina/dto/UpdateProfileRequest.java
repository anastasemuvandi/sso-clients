package com.risa.ikimina.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateProfileRequest {
    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String fullName;

    private String phoneNumber;
}
