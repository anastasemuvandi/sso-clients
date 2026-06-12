package com.risa.ikimina.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * A short-lived 6-digit code emailed to a user, used both for the login second
 * factor (2FA) and for password reset. One row per issued code; {@link #consumed}
 * flips to true once it is spent so a code cannot be replayed.
 */
@Entity
@Table(name = "verification_codes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VerificationCode {

    public enum Purpose { LOGIN_2FA, PASSWORD_RESET }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** The email the code was issued to (lower-cased). */
    @Column(nullable = false)
    private String email;

    @Column(nullable = false, length = 6)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Purpose purpose;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private boolean consumed;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
