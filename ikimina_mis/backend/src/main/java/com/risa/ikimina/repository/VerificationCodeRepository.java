package com.risa.ikimina.repository;

import com.risa.ikimina.entity.VerificationCode;
import com.risa.ikimina.entity.VerificationCode.Purpose;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

public interface VerificationCodeRepository extends JpaRepository<VerificationCode, UUID> {

    Optional<VerificationCode> findByEmailAndCodeAndPurposeAndConsumedFalse(
            String email, String code, Purpose purpose);

    /** Invalidate any outstanding codes of this purpose before issuing a fresh one. */
    @Modifying
    @Transactional
    @Query("update VerificationCode v set v.consumed = true " +
           "where v.email = :email and v.purpose = :purpose and v.consumed = false")
    void consumeOutstanding(String email, Purpose purpose);

    /** Housekeeping: drop expired/used codes. */
    @Modifying
    @Transactional
    @Query("delete from VerificationCode v where v.expiresAt < :cutoff")
    void deleteExpired(LocalDateTime cutoff);
}
