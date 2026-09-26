import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  Card,
  Typography,
  Button,
  List,
  Tag,
  Avatar,
  Descriptions,
  Radio,
  Modal,
  message,
  Spin,
  Form,
  Input,
  DatePicker,
  Popconfirm,
} from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import { columnApi } from '../api/column'
import type { Column, Article } from '../types'
import type { RootState } from '../store'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const statusTag: Record<string, { color: string; text: string }> = {
  DRAFT: { color: 'default', text: '草稿' },
  SCHEDULED: { color: 'gold', text: '预约中' },
  PUBLISHED: { color: 'green', text: '已上线' },
}

function ColumnDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useSelector((state: RootState) => state.auth)
  const [column, setColumn] = useState<Column | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [subscribeModalVisible, setSubscribeModalVisible] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY')
  const [subscribing, setSubscribing] = useState(false)
  const [articleModalVisible, setArticleModalVisible] = useState(false)
  const [creatingArticle, setCreatingArticle] = useState(false)
  const [scheduleTarget, setScheduleTarget] = useState<Article | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const [articleForm] = Form.useForm()
  const [scheduleForm] = Form.useForm<{ scheduledAt: Dayjs }>()

  const isOwner = !!user && !!column && user.id === column.creatorId

  const loadColumnDetail = async (silent = false) => {
    if (!id) return
    if (!silent) setLoading(true)
    try {
      const [columnRes, articlesRes] = await Promise.all([
        columnApi.getById(id),
        columnApi.getArticles(id),
      ])
      setColumn(columnRes.data?.data || null)
      setArticles(articlesRes.data?.data || [])
    } catch (error) {
      console.error('Failed to load column:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      loadColumnDetail()
    }
  }, [id])

  // 作者有待上线的预约文章时轮询刷新，到点后自动出现在列表中（无需手动刷新）
  useEffect(() => {
    if (!isOwner || !articles.some((a) => a.status === 'SCHEDULED')) return
    const timer = setInterval(() => loadColumnDetail(true), 15000)
    return () => clearInterval(timer)
  }, [isOwner, articles])

  const handleSubscribe = async () => {
    if (!id) return
    setSubscribing(true)
    try {
      await columnApi.subscribe(id, selectedPlan)
      message.success('订阅成功')
      setSubscribeModalVisible(false)
    } catch (error) {
      console.error('Subscribe failed:', error)
    } finally {
      setSubscribing(false)
    }
  }

  const handleCreateArticle = async () => {
    if (!id) return
    setCreatingArticle(true)
    try {
      const values = await articleForm.validateFields()
      const res = await columnApi.createArticle(id, values)
      if (res.data?.success) {
        message.success(res.data.message || '草稿已保存')
        setArticleModalVisible(false)
        articleForm.resetFields()
        loadColumnDetail(true)
      } else {
        message.error(res.data?.message || '保存失败')
      }
    } catch (error) {
      console.error('Create article failed:', error)
    } finally {
      setCreatingArticle(false)
    }
  }

  const openScheduleModal = (article: Article) => {
    setScheduleTarget(article)
    scheduleForm.setFieldsValue({
      scheduledAt: article.scheduledAt ? dayjs(article.scheduledAt) : dayjs().add(1, 'hour'),
    })
  }

  const handleSchedule = async () => {
    if (!id || !scheduleTarget) return
    setScheduling(true)
    try {
      const { scheduledAt } = await scheduleForm.validateFields()
      const res = await columnApi.scheduleArticle(
        id,
        scheduleTarget.id,
        scheduledAt.format('YYYY-MM-DDTHH:mm:ss'),
      )
      if (res.data?.success) {
        message.success(res.data.message || '预约成功')
        setScheduleTarget(null)
        loadColumnDetail(true)
      } else {
        message.error(res.data?.message || '预约失败')
      }
    } catch (error) {
      console.error('Schedule article failed:', error)
    } finally {
      setScheduling(false)
    }
  }

  const handleUnschedule = async (article: Article) => {
    if (!id) return
    try {
      const res = await columnApi.unscheduleArticle(id, article.id)
      if (res.data?.success) {
        message.success(res.data.message || '已撤回预约')
        loadColumnDetail(true)
      } else {
        message.error(res.data?.message || '撤回失败')
      }
    } catch (error) {
      console.error('Unschedule article failed:', error)
    }
  }

  const planOptions = column
    ? [
        { label: `月付 ¥${column.monthlyPrice}`, value: 'MONTHLY' },
        { label: `季付 ¥${column.quarterlyPrice}`, value: 'QUARTERLY' },
        { label: `年付 ¥${column.yearlyPrice}`, value: 'YEARLY' },
      ]
    : []

  const articleActions = (article: Article) => {
    if (!isOwner) {
      return [
        <Button
          type="link"
          key="read"
          onClick={() => navigate(`/columns/${id}/articles/${article.id}`)}
        >
          阅读
        </Button>,
      ]
    }
    const actions = []
    if (article.status !== 'PUBLISHED') {
      actions.push(
        <Button type="link" key="schedule" onClick={() => openScheduleModal(article)}>
          {article.status === 'SCHEDULED' ? '修改时间' : '预约上线'}
        </Button>,
      )
    }
    if (article.status === 'SCHEDULED') {
      actions.push(
        <Popconfirm
          key="unschedule"
          title="撤回预约"
          description="撤回后文章恢复为草稿，不再自动上线"
          okText="撤回"
          cancelText="取消"
          onConfirm={() => handleUnschedule(article)}
        >
          <Button type="link" danger>
            撤回预约
          </Button>
        </Popconfirm>,
      )
    }
    actions.push(
      <Button
        type="link"
        key="read"
        onClick={() => navigate(`/columns/${id}/articles/${article.id}`)}
      >
        阅读
      </Button>,
    )
    return actions
  }

  if (loading || !column) {
    return <Spin style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />
  }

  return (
    <div>
      <Card>
        <div style={{ display: 'flex', gap: 24 }}>
          <div
            style={{
              width: 240,
              height: 320,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 96,
              flexShrink: 0,
            }}
          >
            📚
          </div>
          <div style={{ flex: 1 }}>
            <Title level={2}>{column.title}</Title>
            <div style={{ marginBottom: 16 }}>
              <Avatar icon={<span>👤</span>} src={column.creator?.avatar} />
              <Text style={{ marginLeft: 8 }}>{column.creator?.username}</Text>
              <Tag color="purple" style={{ marginLeft: 8 }}>
                {column.category}
              </Tag>
            </div>
            <Paragraph type="secondary">{column.description}</Paragraph>
            <Descriptions column={3} style={{ marginTop: 16 }}>
              <Descriptions.Item label="文章数">{column.articleCount}</Descriptions.Item>
              <Descriptions.Item label="订阅数">{column.subscriberCount}</Descriptions.Item>
              <Descriptions.Item label="月付价格" className="price-text">
                ¥{column.monthlyPrice}
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 24 }}>
              {isOwner ? (
                <Button type="primary" size="large" onClick={() => setArticleModalVisible(true)}>
                  写文章
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  onClick={() => setSubscribeModalVisible(true)}
                >
                  立即订阅
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card
        title={isOwner ? '文章管理（草稿与预约中的文章仅自己可见）' : '文章列表'}
        style={{ marginTop: 24 }}
      >
        <List
          dataSource={articles}
          renderItem={(article, index) => (
            <List.Item actions={articleActions(article)}>
              <List.Item.Meta
                title={
                  <span>
                    <Text type="secondary" style={{ marginRight: 12 }}>
                      #{index + 1}
                    </Text>
                    {article.title}
                    {isOwner && article.status && (
                      <Tag color={statusTag[article.status]?.color} style={{ marginLeft: 8 }}>
                        {statusTag[article.status]?.text}
                      </Tag>
                    )}
                  </span>
                }
                description={
                  <div>
                    <div>{article.summary || article.description}</div>
                    {isOwner && article.status === 'SCHEDULED' && article.scheduledAt && (
                      <Text type="warning" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined /> 将于{' '}
                        {dayjs(article.scheduledAt).format('YYYY-MM-DD HH:mm')} 自动上线
                      </Text>
                    )}
                    {article.status === 'PUBLISHED' && article.publishedAt && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        上线于 {dayjs(article.publishedAt).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title="选择订阅计划"
        open={subscribeModalVisible}
        onOk={handleSubscribe}
        onCancel={() => setSubscribeModalVisible(false)}
        confirmLoading={subscribing}
        okText="确认订阅"
        cancelText="取消"
      >
        <Radio.Group
          value={selectedPlan}
          onChange={(e) =>
            setSelectedPlan(e.target.value as 'MONTHLY' | 'QUARTERLY' | 'YEARLY')
          }
          style={{ width: '100%' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {planOptions.map((option) => (
              <Radio value={option.value} key={option.value}>
                {option.label}
              </Radio>
            ))}
          </div>
        </Radio.Group>
      </Modal>

      <Modal
        title="写文章（保存为草稿，仅自己可见）"
        open={articleModalVisible}
        onOk={handleCreateArticle}
        onCancel={() => setArticleModalVisible(false)}
        confirmLoading={creatingArticle}
        okText="保存草稿"
        cancelText="取消"
        width={640}
      >
        <Form form={articleForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入文章标题' }]}>
            <Input placeholder="请输入文章标题" maxLength={100} />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <TextArea rows={2} placeholder="一句话介绍这篇文章（可选）" maxLength={200} />
          </Form.Item>
          <Form.Item name="content" label="正文" rules={[{ required: true, message: '请输入正文内容' }]}>
            <TextArea rows={8} placeholder="请输入正文内容" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={scheduleTarget?.status === 'SCHEDULED' ? '修改预约上线时间' : '预约上线'}
        open={!!scheduleTarget}
        onOk={handleSchedule}
        onCancel={() => setScheduleTarget(null)}
        confirmLoading={scheduling}
        okText="确定"
        cancelText="取消"
        destroyOnClose
      >
        <Paragraph type="secondary">
          到点后文章会自动出现在专栏页；未到点前只有你自己能看到，期间可随时修改时间或撤回预约。
        </Paragraph>
        <Form form={scheduleForm} layout="vertical">
          <Form.Item
            name="scheduledAt"
            label="上线时间"
            rules={[{ required: true, message: '请选择上线时间' }]}
          >
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ColumnDetail
