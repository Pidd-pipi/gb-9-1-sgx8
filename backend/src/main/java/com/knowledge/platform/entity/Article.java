package com.knowledge.platform.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "articles")
public class Article {
    @Id
    private String id;

    @Indexed
    private String columnId;

    @Indexed
    private String authorId;

    @TextIndexed(weight = 3)
    private String title;

    @TextIndexed(weight = 2)
    private String summary;

    @TextIndexed(weight = 1)
    private String content;

    private Integer sequence;

    private Status status = Status.DRAFT;

    private LocalDateTime scheduledAt;

    private LocalDateTime publishedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum Status {
        DRAFT,
        SCHEDULED,
        PUBLISHED
    }
}
