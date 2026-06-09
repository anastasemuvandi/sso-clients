package com.risa.rmis.repository;

import com.risa.rmis.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByEmail(String email);
    // [GoR-SSO] Look a user up by their Keycloak "sub" so repeated SSO logins map
    // [GoR-SSO] to the same local row even if username/email later change.
    Optional<User> findBySsoSubject(String ssoSubject);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
}
