package com.knowledge.platform.repository;

import com.knowledge.platform.entity.Article;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.domain.Sort;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface ArticleRepository extends MongoRepository<Article, String> {
    Page<Article> findByColumnId(String columnId, Pageable pageable);
    List<Article> findByColumnIdOrderBySequenceAsc(String columnId);
    Optional<Article> findByColumnIdAndId(String columnId, String id);
    long countByColumnId(String columnId);

    /**
     * 读者视角：专栏页只展示已上线文章，按上线时间倒序，最新文章在最前。
     * 兼容历史数据（无 status 字段时视为已上线）。
     */
    @Query("{'columnId': ?0, '$or': [{'status': 'PUBLISHED'}, {'status': {'$exists': false}}]}")
    List<Article> findPublishedByColumnId(String columnId, Sort sort);

    /**
     * 定时任务（含服务重启后的补跑）：找出所有到点、仍处于预约中的文章。
     */
    List<Article> findByStatusAndScheduledAtLessThanEqual(Article.Status status, LocalDateTime now);

    /**
     * 全文检索只返回已上线文章，避免草稿、预约中的文章被搜到。
     */
    @Query("{'$text': {'$search': ?0}, '$or': [{'status': 'PUBLISHED'}, {'status': {'$exists': false}}]}")
    List<Article> searchPublishedByKeyword(String keyword);
}
