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

    /**
     * 作者用户 ID（专栏创建者），用于归属校验：未上线的文章只有作者本人能看到、能操作。
     */
    @Indexed
    private String authorId;

    @TextIndexed(weight = 3)
    private String title;

    @TextIndexed(weight = 2)
    private String summary;

    @TextIndexed(weight = 1)
    private String content;

    private Integer sequence;

    /**
     * DRAFT 草稿（仅作者可见）；SCHEDULED 已预约（未到点前仅作者可见）；PUBLISHED 已上线（读者可见）。
     */
    @Indexed
    private Status status = Status.DRAFT;

    /**
     * 预约上线时间。状态为 SCHEDULED 时有效，到点由定时任务原子地切换为 PUBLISHED。
     */
    @Indexed
    private LocalDateTime scheduledAt;

    /**
     * 实际上线时间，读者专栏页按它倒序展示最新已上线文章。
     */
    @Indexed
    private LocalDateTime publishedAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public enum Status {
        DRAFT,
        SCHEDULED,
        PUBLISHED
    }
}
