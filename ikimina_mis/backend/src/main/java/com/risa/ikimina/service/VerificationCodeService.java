package com.risa.ikimina.service;

import com.risa.ikimina.entity.VerificationCode;
import com.risa.ikimina.entity.VerificationCode.Purpose;
import com.risa.ikimina.repository.VerificationCodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;

/** Issues and verifies the 6-digit codes used for 2FA login and password reset. */
@Service
@RequiredArgsConstructor
public class VerificationCodeService {

    private final VerificationCodeRepository codeRepository;
    private final SecureRandom random = new SecureRandom();

    @Value("${app.verification.code-ttl-minutes}")
    private long ttlMinutes;

    /**
     * Invalidate any outstanding codes of this purpose for the email, then create,
     * persist and return a fresh 6-digit code. Caller is responsible for emailing it.
     */
    public String issue(String email, Purpose purpose) {
        String normalized = email.toLowerCase();
        codeRepository.consumeOutstanding(normalized, purpose);

        String code = String.format("%06d", random.nextInt(1_000_000));
        VerificationCode entity = VerificationCode.builder()
                .email(normalized)
                .code(code)
                .purpose(purpose)
                .expiresAt(LocalDateTime.now().plusMinutes(ttlMinutes))
                .consumed(false)
                .build();
        codeRepository.save(entity);
        return code;
    }

    /**
     * Validate a submitted code for the given email/purpose. On success the code is
     * marked consumed (single use) and true is returned; otherwise false.
     */
    public boolean verifyAndConsume(String email, String code, Purpose purpose) {
        return codeRepository
                .findByEmailAndCodeAndPurposeAndConsumedFalse(email.toLowerCase(), code, purpose)
                .filter(vc -> vc.getExpiresAt().isAfter(LocalDateTime.now()))
                .map(vc -> {
                    vc.setConsumed(true);
                    codeRepository.save(vc);
                    return true;
                })
                .orElse(false);
    }
}
