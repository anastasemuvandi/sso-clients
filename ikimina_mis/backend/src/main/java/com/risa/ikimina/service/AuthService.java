package com.risa.ikimina.service;

import com.risa.ikimina.dto.*;
import com.risa.ikimina.entity.User;
import com.risa.ikimina.entity.VerificationCode.Purpose;
import com.risa.ikimina.repository.UserRepository;
import com.risa.ikimina.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;
    private final VerificationCodeService codeService;
    private final EmailService emailService;

    /** Create a local account. The user then logs in (which triggers 2FA). */
    public void register(RegisterRequest request) {
        String email = request.getEmail().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already registered");
        }
        User user = User.builder()
                .email(email)
                .password(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .phoneNumber(request.getPhoneNumber())
                .build();
        userRepository.save(user);
    }

    /**
     * Step 1 of login: verify the password, then email a 2FA code. No token is
     * issued here — the client must complete {@link #verifyTwoFactor}.
     */
    public LoginResponse login(LoginRequest request) {
        String email = request.getEmail().toLowerCase();
        // throws BadCredentialsException on a wrong password / unknown email
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(email, request.getPassword())
        );
        String code = codeService.issue(email, Purpose.LOGIN_2FA);
        emailService.sendTwoFactorCode(email, code);
        return LoginResponse.builder()
                .twoFactorRequired(true)
                .email(email)
                .message("A verification code has been sent to your email.")
                .build();
    }

    /** Step 2 of login: validate the emailed code and issue the JWT. */
    public AuthResponse verifyTwoFactor(VerifyTwoFactorRequest request) {
        String email = request.getEmail().toLowerCase();
        if (!codeService.verifyAndConsume(email, request.getCode(), Purpose.LOGIN_2FA)) {
            throw new IllegalArgumentException("Invalid or expired verification code");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));
        UserDetails userDetails = userDetailsService.loadUserByUsername(email);
        String token = jwtTokenProvider.generateToken(userDetails);
        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .fullName(user.getFullName())
                .build();
    }

    /**
     * Begin password reset: if the email maps to an account, email a reset code.
     * Always succeeds silently so callers can't probe which emails are registered.
     */
    public void forgotPassword(ForgotPasswordRequest request) {
        String email = request.getEmail().toLowerCase();
        userRepository.findByEmail(email).ifPresent(user -> {
            String code = codeService.issue(email, Purpose.PASSWORD_RESET);
            emailService.sendPasswordResetCode(email, code);
        });
    }

    /** Complete password reset using the emailed code. */
    public void resetPassword(ResetPasswordRequest request) {
        String email = request.getEmail().toLowerCase();
        if (!codeService.verifyAndConsume(email, request.getCode(), Purpose.PASSWORD_RESET)) {
            throw new IllegalArgumentException("Invalid or expired reset code");
        }
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Account not found"));
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }
}
