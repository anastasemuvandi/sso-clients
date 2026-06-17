package com.risa.irmis.security;

import com.risa.irmis.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    /** Login identifier is the email, so the Spring "username" we load by is the email. */
    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        com.risa.irmis.entity.User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

        // Spring's hasRole('ADMIN') checks for the authority "ROLE_ADMIN".
        var authority = new SimpleGrantedAuthority("ROLE_" + user.getRole().name());
        return new User(user.getEmail(), user.getPassword(), List.of(authority));
    }
}
