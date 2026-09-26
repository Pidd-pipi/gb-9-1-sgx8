package com.knowledge.platform.service;

import com.knowledge.platform.dto.ApiResponse;
import com.knowledge.platform.dto.ArticleCreateRequest;
import com.knowledge.platform.entity.Article;
import com.knowledge.platform.entity.Column;
import com.knowledge.platform.repository.ArticleRepository;
import com.knowledge.platform.repository.ColumnRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ArticleService {
    @Autowired
    private ArticleRepository articleRepository;

    @Autowired
    private ColumnRepository columnRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    /**
     * 专栏文章列表：已上线文章所有人可见，草稿和预约中的文章仅作者本人可见。
     */
    public List<Article> getVisibleArticles(String columnId, String userId) {
        return articleRepository.findByColumnIdOrderBySequenceAsc(columnId).stream()
                .filter(article -> isVisibleTo(article, userId))
                .toList();
    }

    public Optional<Article> getVisibleArticle(String columnId, String articleId, String userId) {
        return articleRepository.findByColumnIdAndId(columnId, articleId)
                .filter(article -> isVisibleTo(article, userId));
    }

    public ApiResponse<Article> createArticle(String userId, String columnId, ArticleCreateRequest request) {
        Optional<Column> columnOpt = columnRepository.findById(columnId);
        if (columnOpt.isEmpty()) {
            return ApiResponse.error("专栏不存在");
        }
        if (!columnOpt.get().getCreatorId().equals(userId)) {
            return ApiResponse.error("只有专栏作者才能发布文章");
        }
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            return ApiResponse.error("文章标题不能为空");
        }
        if (request.getContent() == null || request.getContent().isBlank()) {
            return ApiResponse.error("文章内容不能为空");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime scheduledAt = request.getScheduledAt();
        if (scheduledAt != null && !scheduledAt.isAfter(now)) {
            return ApiResponse.error("预约时间已过，请选择未来的时间");
        }

        Article article = new Article();
        article.setColumnId(columnId);
        article.setAuthorId(userId);
        article.setTitle(request.getTitle());
        article.setSummary(request.getSummary());
        article.setContent(request.getContent());
        article.setSequence(request.getSequence() != null
                ? request.getSequence()
                : (int) articleRepository.countByColumnId(columnId) + 1);
        article.setCreatedAt(now);
        article.setUpdatedAt(now);

        if (scheduledAt != null) {
            article.setStatus(Article.Status.SCHEDULED);
            article.setScheduledAt(scheduledAt);
        } else {
            article.setStatus(Article.Status.PUBLISHED);
            article.setPublishedAt(now);
        }

        article = articleRepository.save(article);
        if (article.getStatus() == Article.Status.PUBLISHED) {
            incrementArticleCount(columnId);
            return ApiResponse.success("文章已上线", article);
        }
        return ApiResponse.success("文章已预约，将于 " + scheduledAt + " 自动上线", article);
    }

    /**
     * 为文章预约上线时间；已预约的文章重复调用即为修改时间，原地更新不会产生第二份。
     * 状态流转通过带状态条件的原子更新完成，与定时上线任务互斥。
     */
    public ApiResponse<Article> scheduleArticle(String userId, String columnId, String articleId, LocalDateTime scheduledAt) {
        Optional<Article> articleOpt = articleRepository.findByColumnIdAndId(columnId, articleId);
        if (articleOpt.isEmpty()) {
            return ApiResponse.error("文章不存在");
        }
        Article article = articleOpt.get();
        if (!userId.equals(article.getAuthorId())) {
            return ApiResponse.error("无权操作他人的文章");
        }
        if (article.getStatus() == Article.Status.PUBLISHED) {
            return ApiResponse.error("文章已上线，无法预约");
        }
        if (scheduledAt == null || !scheduledAt.isAfter(LocalDateTime.now())) {
            return ApiResponse.error("预约时间已过，请选择未来的时间");
        }

        Query query = Query.query(Criteria.where("id").is(article.getId())
                .and("status").in(Article.Status.DRAFT, Article.Status.SCHEDULED));
        Update update = new Update()
                .set("status", Article.Status.SCHEDULED)
                .set("scheduledAt", scheduledAt)
                .set("updatedAt", LocalDateTime.now());
        Article updated = mongoTemplate.findAndModify(
                query, update, FindAndModifyOptions.options().returnNew(true), Article.class);
        if (updated == null) {
            return ApiResponse.error("文章已上线，无法预约");
        }
        return ApiResponse.success("预约成功，将于 " + scheduledAt + " 自动上线", updated);
    }

    /**
     * 撤回预约：文章回到草稿状态，仍只有作者本人可见。
     */
    public ApiResponse<Article> cancelSchedule(String userId, String columnId, String articleId) {
        Optional<Article> articleOpt = articleRepository.findByColumnIdAndId(columnId, articleId);
        if (articleOpt.isEmpty()) {
            return ApiResponse.error("文章不存在");
        }
        Article article = articleOpt.get();
        if (!userId.equals(article.getAuthorId())) {
            return ApiResponse.error("无权操作他人的文章");
        }
        if (article.getStatus() == Article.Status.PUBLISHED) {
            return ApiResponse.error("文章已上线，无法撤回");
        }
        if (article.getStatus() != Article.Status.SCHEDULED) {
            return ApiResponse.error("文章未在预约中");
        }

        Query query = Query.query(Criteria.where("id").is(article.getId())
                .and("status").is(Article.Status.SCHEDULED));
        Update update = new Update()
                .set("status", Article.Status.DRAFT)
                .unset("scheduledAt")
                .set("updatedAt", LocalDateTime.now());
        Article updated = mongoTemplate.findAndModify(
                query, update, FindAndModifyOptions.options().returnNew(true), Article.class);
        if (updated == null) {
            return ApiResponse.error("文章已上线，无法撤回");
        }
        return ApiResponse.success("已撤回预约，文章转为草稿", updated);
    }

    public ApiResponse<Article> publishNow(String userId, String columnId, String articleId) {
        Optional<Article> articleOpt = articleRepository.findByColumnIdAndId(columnId, articleId);
        if (articleOpt.isEmpty()) {
            return ApiResponse.error("文章不存在");
        }
        Article article = articleOpt.get();
        if (!userId.equals(article.getAuthorId())) {
            return ApiResponse.error("无权操作他人的文章");
        }
        if (article.getStatus() == Article.Status.PUBLISHED) {
            return ApiResponse.error("文章已上线，请勿重复操作");
        }

        LocalDateTime now = LocalDateTime.now();
        Query query = Query.query(Criteria.where("id").is(article.getId())
                .and("status").in(Article.Status.DRAFT, Article.Status.SCHEDULED));
        Update update = new Update()
                .set("status", Article.Status.PUBLISHED)
                .set("publishedAt", now)
                .unset("scheduledAt")
                .set("updatedAt", now);
        Article updated = mongoTemplate.findAndModify(
                query, update, FindAndModifyOptions.options().returnNew(true), Article.class);
        if (updated == null) {
            return ApiResponse.error("文章已上线，请勿重复操作");
        }
        incrementArticleCount(columnId);
        return ApiResponse.success("文章已上线", updated);
    }

    /**
     * 将到点的预约文章上线。通过带状态条件的原子更新完成状态流转，
     * 同一篇文章只会被上线一次，重复执行或服务重启后补发都不会产生重复结果。
     */
    public int publishDueArticles() {
        LocalDateTime now = LocalDateTime.now();
        List<Article> dueArticles = articleRepository
                .findByStatusAndScheduledAtLessThanEqual(Article.Status.SCHEDULED, now);
        int publishedCount = 0;
        for (Article article : dueArticles) {
            Query query = Query.query(Criteria.where("id").is(article.getId())
                    .and("status").is(Article.Status.SCHEDULED));
            Update update = new Update()
                    .set("status", Article.Status.PUBLISHED)
                    .set("publishedAt", now)
                    .unset("scheduledAt")
                    .set("updatedAt", now);
            Article transitioned = mongoTemplate.findAndModify(query, update, Article.class);
            if (transitioned != null) {
                incrementArticleCount(article.getColumnId());
                publishedCount++;
            }
        }
        return publishedCount;
    }

    private boolean isVisibleTo(Article article, String userId) {
        // 历史数据没有状态字段，按已上线处理
        if (article.getStatus() == null || article.getStatus() == Article.Status.PUBLISHED) {
            return true;
        }
        return userId != null && userId.equals(article.getAuthorId());
    }

    private void incrementArticleCount(String columnId) {
        mongoTemplate.updateFirst(
                Query.query(Criteria.where("id").is(columnId)),
                new Update().inc("articleCount", 1).set("updatedAt", LocalDateTime.now()),
                Column.class);
    }
}
