package com.knowledge.platform.service;

import com.knowledge.platform.dto.ApiResponse;
import com.knowledge.platform.dto.ArticleCreateRequest;
import com.knowledge.platform.entity.Article;
import com.knowledge.platform.entity.Column;
import com.knowledge.platform.repository.ArticleRepository;
import com.knowledge.platform.repository.ColumnRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
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

    private static final Logger log = LoggerFactory.getLogger(ArticleService.class);

    @Autowired
    private ArticleRepository articleRepository;

    @Autowired
    private ColumnRepository columnRepository;

    @Autowired
    private MongoTemplate mongoTemplate;

    /**
     * 作者新建草稿。草稿不进入读者专栏页，只有作者本人能看到。
     */
    public ApiResponse<Article> createDraft(String userId, String columnId, ArticleCreateRequest request) {
        if (userId == null) {
            return ApiResponse.error("请先登录");
        }
        Optional<Column> columnOpt = columnRepository.findById(columnId);
        if (columnOpt.isEmpty()) {
            return ApiResponse.error("专栏不存在");
        }
        Column column = columnOpt.get();
        if (!userId.equals(column.getCreatorId())) {
            return ApiResponse.error("无权在他人专栏下创建文章");
        }
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            return ApiResponse.error("文章标题不能为空");
        }

        LocalDateTime now = LocalDateTime.now();
        Article article = new Article();
        article.setColumnId(columnId);
        article.setAuthorId(userId);
        article.setTitle(request.getTitle().trim());
        article.setSummary(request.getSummary());
        article.setContent(request.getContent());
        article.setSequence(request.getSequence() != null
                ? request.getSequence()
                : (int) articleRepository.countByColumnId(columnId) + 1);
        article.setStatus(Article.Status.DRAFT);
        article.setCreatedAt(now);
        article.setUpdatedAt(now);
        article = articleRepository.save(article);
        return ApiResponse.success("草稿已保存", article);
    }

    /**
     * 预约上线：为草稿选定未来时间。上线前可反复修改时间，已上线后明确拒绝。
     */
    public ApiResponse<Article> schedule(String userId, String columnId, String articleId,
                                         LocalDateTime scheduledAt) {
        if (userId == null) {
            return ApiResponse.error("请先登录");
        }
        if (scheduledAt == null) {
            return ApiResponse.error("请选择预约上线时间");
        }
        if (!scheduledAt.isAfter(LocalDateTime.now())) {
            return ApiResponse.error("预约上线时间必须晚于当前时间");
        }

        Optional<Article> articleOpt = articleRepository.findByColumnIdAndId(columnId, articleId);
        if (articleOpt.isEmpty()) {
            return ApiResponse.error("文章不存在");
        }
        Article article = articleOpt.get();

        if (!isOwner(userId, article)) {
            return ApiResponse.error("文章不属于本人，无权操作");
        }
        if (article.getStatus() == Article.Status.PUBLISHED) {
            return ApiResponse.error("文章已到上线时间，不能再修改预约时间");
        }

        article.setStatus(Article.Status.SCHEDULED);
        article.setScheduledAt(scheduledAt);
        article.setUpdatedAt(LocalDateTime.now());
        article = articleRepository.save(article);
        return ApiResponse.success("预约上线时间已设定", article);
    }

    /**
     * 撤回预约：恢复为草稿，到点不再自动上线。仅上线前可撤回。
     */
    public ApiResponse<Article> unschedule(String userId, String columnId, String articleId) {
        if (userId == null) {
            return ApiResponse.error("请先登录");
        }
        Optional<Article> articleOpt = articleRepository.findByColumnIdAndId(columnId, articleId);
        if (articleOpt.isEmpty()) {
            return ApiResponse.error("文章不存在");
        }
        Article article = articleOpt.get();

        if (!isOwner(userId, article)) {
            return ApiResponse.error("文章不属于本人，无权操作");
        }
        if (article.getStatus() == Article.Status.PUBLISHED) {
            return ApiResponse.error("文章已到上线时间，不能撤回预约");
        }
        if (article.getStatus() != Article.Status.SCHEDULED) {
            return ApiResponse.error("文章尚未预约上线，无需撤回");
        }

        article.setStatus(Article.Status.DRAFT);
        article.setScheduledAt(null);
        article.setUpdatedAt(LocalDateTime.now());
        article = articleRepository.save(article);
        return ApiResponse.success("已撤回预约，文章恢复为草稿", article);
    }

    /**
     * 专栏文章列表：作者看到全部（含草稿/预约中），读者只看到已上线文章，
     * 且已上线文章按上线时间倒序，最新的排最前。
     */
    public List<Article> listForColumn(String columnId, String currentUserId) {
        if (isColumnOwner(columnId, currentUserId)) {
            return articleRepository.findByColumnIdOrderBySequenceAsc(columnId);
        }
        return articleRepository.findPublishedByColumnId(
                columnId,
                Sort.by(Sort.Order.desc("publishedAt"), Sort.Order.asc("sequence")));
    }

    /**
     * 单篇文章：已上线人人可看；未上线只有作者本人能看，其他人明确拒绝。
     */
    public ApiResponse<Article> getForReader(String columnId, String articleId, String currentUserId) {
        Optional<Article> articleOpt = articleRepository.findByColumnIdAndId(columnId, articleId);
        if (articleOpt.isEmpty()) {
            return ApiResponse.error("文章不存在");
        }
        Article article = articleOpt.get();
        if (isPublished(article) || isOwner(currentUserId, article)) {
            return ApiResponse.success(article);
        }
        if (article.getStatus() == Article.Status.SCHEDULED) {
            return ApiResponse.error("文章尚未到上线时间");
        }
        return ApiResponse.error("草稿文章仅作者本人可见");
    }

    /**
     * 发布所有到点的预约文章。服务启动时补跑一次，之后定时扫描，
     * 保证服务停过再启动后，错过的预约仍会上线且结果持久保留。
     *
     * @return 本次实际上线的文章数
     */
    public int publishDueArticles() {
        List<Article> due = articleRepository
                .findByStatusAndScheduledAtLessThanEqual(Article.Status.SCHEDULED, LocalDateTime.now());
        int published = 0;
        for (Article article : due) {
            if (publishAtomically(article.getId())) {
                published++;
            }
        }
        if (published > 0) {
            log.info("预约文章自动上线 {} 篇", published);
        }
        return published;
    }

    /**
     * 原子地把一篇文章从 SCHEDULED 切换到 PUBLISHED。
     * 以 status 作为乐观条件：只有一个执行者能改成功，因此即使定时任务与启动补跑重叠、
     * 或多次扫描，同一篇文章也只会上线一次、专栏文章数只加一次，不会出现两份。
     */
    private boolean publishAtomically(String articleId) {
        LocalDateTime now = LocalDateTime.now();
        Query articleQuery = new Query(Criteria.where("_id").is(articleId)
                .and("status").is(Article.Status.SCHEDULED));
        Update articleUpdate = new Update()
                .set("status", Article.Status.PUBLISHED)
                .set("publishedAt", now)
                .set("updatedAt", now);
        Article winner = mongoTemplate.findAndModify(articleQuery, articleUpdate, Article.class);
        if (winner == null) {
            return false;
        }

        Query columnQuery = new Query(Criteria.where("_id").is(winner.getColumnId()));
        mongoTemplate.updateFirst(columnQuery, new Update().inc("articleCount", 1), Column.class);
        return true;
    }

    private boolean isOwner(String userId, Article article) {
        return userId != null
                && (userId.equals(article.getAuthorId())
                    || (article.getAuthorId() == null && isColumnOwner(article.getColumnId(), userId)));
    }

    private boolean isColumnOwner(String columnId, String userId) {
        if (userId == null) {
            return false;
        }
        return columnRepository.findById(columnId)
                .map(column -> userId.equals(column.getCreatorId()))
                .orElse(false);
    }

    private boolean isPublished(Article article) {
        return article.getStatus() == Article.Status.PUBLISHED || article.getStatus() == null;
    }
}
