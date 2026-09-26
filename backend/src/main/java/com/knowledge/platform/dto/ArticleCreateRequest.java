package com.knowledge.platform.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ArticleCreateRequest {
    private String title;
    private String summary;
    private String content;
    private Integer sequence;
    private LocalDateTime scheduledAt;
}
