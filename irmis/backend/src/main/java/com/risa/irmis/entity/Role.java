package com.risa.irmis.entity;

/**
 * Access role for an account. {@code USER} sees only their own profile;
 * {@code ADMIN} may additionally list all users.
 */
public enum Role {
    USER,
    ADMIN
}
