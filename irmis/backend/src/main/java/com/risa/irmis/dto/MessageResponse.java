package com.risa.irmis.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/** Generic {"message": "..."} body for endpoints that return no entity. */
@Data
@AllArgsConstructor
public class MessageResponse {
    private String message;
}
