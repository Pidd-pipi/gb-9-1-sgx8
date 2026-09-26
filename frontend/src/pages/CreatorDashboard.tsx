import { useEffect, useState } from 'react'
import { Card, Typography, Row, Col, Statistic, Button, List, Avatar, Tag, message, Spin, Modal, Form, Input, Select, Upload, Drawer, DatePicker, Popconfirm, Space } from 'antd'
import { BookOutlined, SoundOutlined, ReadOutlined, PlusOutlined, UploadOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs, { Dayjs } from 'dayjs'
import { creatorApi } from '../api/creator'
import { columnApi } from '../api/column'
import { audioApi } from '../api/audio'
import { ebookApi } from '../api/ebook'
import type { Column, AudioCourse, Ebook, Article } from '../types'

const { Title } = Typography
const { TextArea } = Input

function CreatorDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [columns, setColumns] = useState<Column[]>([])
  const [audio, setAudio] = useState<AudioCourse[]>([])
  const [ebooks, setEbooks] = useState<Ebook[]>([])
  const [columnModalVisible, setColumnModalVisible] = useState(false)
  const [audioModalVisible, setAudioModalVisible] = useState(false)
  const [ebookModalVisible, setEbookModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [columnForm] = Form.useForm()
  const [audioForm] = Form.useForm()
  const [ebookForm] = Form.useForm()

  // 文章管理
  const [articleDrawerColumn, setArticleDrawerColumn] = useState<Column | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [articleModalVisible, setArticleModalVisible] = useState(false)
  const [articleSubmitting, setArticleSubmitting] = useState(false)
  const [articleForm] = Form.useForm()
  const [rescheduleArticle, setRescheduleArticle] = useState<Article | null>(null)
  const [rescheduleTime, setRescheduleTime] = useState<Dayjs | null>(null)
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [columnsRes, audioRes, ebooksRes] = await Promise.all([
        columnApi.list({ size: 10 }),
        audioApi.list({ size: 10 }),
        ebookApi.list({ size: 10 }),
      ])
      setColumns(columnsRes.data?.data?.content || columnsRes.data || [])
      setAudio(audioRes.data?.data?.content || audioRes.data || [])
      setEbooks(ebooksRes.data?.data?.content || ebooksRes.data || [])
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateColumn = async () => {
    setSubmitting(true)
    try {
      const values = await columnForm.validateFields()
      await columnApi.create(values)
      message.success('专栏创建成功')
      setColumnModalVisible(false)
      columnForm.resetFields()
      loadData()
    } catch (error) {
      console.error('Create column failed:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateAudio = async () => {
    setSubmitting(true)
    try {
      const values = await audioForm.validateFields()
      await audioApi.create(values)
      message.success('音频课程创建成功')
      setAudioModalVisible(false)
      audioForm.resetFields()
      loadData()
    } catch (error) {
      console.error('Create audio failed:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateEbook = async () => {
    setSubmitting(true)
    try {
      const values = await ebookForm.validateFields()
      await ebookApi.create(values)
      message.success('电子书创建成功')
      setEbookModalVisible(false)
      ebookForm.resetFields()
      loadData()
    } catch (error) {
      console.error('Create ebook failed:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const openArticleDrawer = async (column: Column) => {
    setArticleDrawerColumn(column)
    await loadArticles(column.id)
  }

  const loadArticles = async (columnId: string) => {
    setArticlesLoading(true)
    try {
      const res = await columnApi.getArticles(columnId)
      setArticles(res.data?.data || [])
    } catch (error) {
      console.error('Failed to load articles:', error)
    } finally {
      setArticlesLoading(false)
    }
  }

  const handleCreateArticle = async () => {
    if (!articleDrawerColumn) return
    setArticleSubmitting(true)
    try {
      const values = await articleForm.validateFields()
      const payload: any = {
        title: values.title,
        summary: values.summary,
        content: values.content,
        sequence: values.sequence ? Number(values.sequence) : undefined,
      }
      if (values.scheduledAt) {
        payload.scheduledAt = (values.scheduledAt as Dayjs).format('YYYY-MM-DDTHH:mm:ss')
      }
      const res = await columnApi.createArticle(articleDrawerColumn.id, payload)
      if (res.data?.success === false) {
        message.error(res.data?.message || '保存失败')
        return
      }
      message.success(res.data?.message || '文章已保存')
      setArticleModalVisible(false)
      articleForm.resetFields()
      loadArticles(articleDrawerColumn.id)
    } catch (error) {
      console.error('Create article failed:', error)
    } finally {
      setArticleSubmitting(false)
    }
  }

  const handleReschedule = async () => {
    if (!articleDrawerColumn || !rescheduleArticle || !rescheduleTime) {
      message.warning('请选择新的上线时间')
      return
    }
    setRescheduleSubmitting(true)
    try {
      const res = await columnApi.scheduleArticle(
        articleDrawerColumn.id,
        rescheduleArticle.id,
        rescheduleTime.format('YYYY-MM-DDTHH:mm:ss')
      )
      if (res.data?.success === false) {
        message.error(res.data?.message || '操作失败')
        return
      }
      message.success(res.data?.message || '预约时间已修改')
      setRescheduleArticle(null)
      setRescheduleTime(null)
      loadArticles(articleDrawerColumn.id)
    } catch (error) {
      console.error('Reschedule failed:', error)
    } finally {
      setRescheduleSubmitting(false)
    }
  }

  const handleCancelSchedule = async (article: Article) => {
    if (!articleDrawerColumn) return
    try {
      const res = await columnApi.cancelSchedule(articleDrawerColumn.id, article.id)
      if (res.data?.success === false) {
        message.error(res.data?.message || '操作失败')
        return
      }
      message.success(res.data?.message || '已撤回预约')
      loadArticles(articleDrawerColumn.id)
    } catch (error) {
      console.error('Cancel schedule failed:', error)
    }
  }

  const handlePublishNow = async (article: Article) => {
    if (!articleDrawerColumn) return
    try {
      const res = await columnApi.publishArticle(articleDrawerColumn.id, article.id)
      if (res.data?.success === false) {
        message.error(res.data?.message || '操作失败')
        return
      }
      message.success(res.data?.message || '文章已上线')
      loadArticles(articleDrawerColumn.id)
    } catch (error) {
      console.error('Publish failed:', error)
    }
  }

  const renderArticleStatus = (article: Article) => {
    if (article.status === 'SCHEDULED') {
      return (
        <Tag icon={<ClockCircleOutlined />} color="orange">
          预约中 · {dayjs(article.scheduledAt).format('MM-DD HH:mm')} 上线
        </Tag>
      )
    }
    if (article.status === 'DRAFT') {
      return <Tag>草稿</Tag>
    }
    return <Tag color="green">已上线</Tag>
  }

  const renderArticleActions = (article: Article) => {
    const actions = []
    if (article.status === 'SCHEDULED') {
      actions.push(
        <Button
          type="link"
          key="reschedule"
          onClick={() => {
            setRescheduleArticle(article)
            setRescheduleTime(article.scheduledAt ? dayjs(article.scheduledAt) : null)
          }}
        >
          改时间
        </Button>
      )
      actions.push(
        <Popconfirm
          key="cancel"
          title="撤回预约"
          description="撤回后文章转为草稿，仅自己可见"
          onConfirm={() => handleCancelSchedule(article)}
          okText="撤回"
          cancelText="取消"
        >
          <Button type="link" danger>
            撤回
          </Button>
        </Popconfirm>
      )
    }
    if (article.status === 'DRAFT' || article.status === 'SCHEDULED') {
      actions.push(
        <Button type="link" key="publish" onClick={() => handlePublishNow(article)}>
          立即上线
        </Button>
      )
    }
    if (article.status === 'DRAFT') {
      actions.push(
        <Button
          type="link"
          key="schedule"
          onClick={() => {
            setRescheduleArticle(article)
            setRescheduleTime(null)
          }}
        >
          预约上线
        </Button>
      )
    }
    return actions
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>创作者中心</Title>
        <div style={{ gap: 12, display: 'flex' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setColumnModalVisible(true)}>
            发布专栏
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAudioModalVisible(true)}>
            发布音频课程
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEbookModalVisible(true)}>
            发布电子书
          </Button>
        </div>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic title="专栏数量" value={columns.length} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="音频课程" value={audio.length} prefix={<SoundOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="电子书" value={ebooks.length} prefix={<ReadOutlined />} />
          </Card>
        </Col>
      </Row>

      <Spin spinning={loading}>
        <Card title="我的专栏" style={{ marginBottom: 24 }}>
          <List
            dataSource={columns}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button type="link" key="articles" onClick={() => openArticleDrawer(item)}>
                    文章管理
                  </Button>,
                  <Button type="link" key="edit" onClick={() => navigate(`/columns/${item.id}`)}>
                    查看
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<BookOutlined />} style={{ background: '#722ed1' }} />}
                  title={item.title}
                  description={
                    <div>
                      <Tag color="purple">¥{item.monthlyPrice}/月</Tag>
                      <Tag>{item.articleCount}篇文章</Tag>
                      <Tag>{item.subscriberCount}订阅</Tag>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Card title="我的音频课程" style={{ marginBottom: 24 }}>
          <List
            dataSource={audio}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button type="link" key="view" onClick={() => navigate(`/audio/${item.id}`)}>
                    查看
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<SoundOutlined />} style={{ background: '#eb2f96' }} />}
                  title={item.title}
                  description={
                    <div>
                      <Tag color="magenta">¥{item.price}</Tag>
                      <Tag>{item.episodeCount}集</Tag>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>

        <Card title="我的电子书">
          <List
            dataSource={ebooks}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button type="link" key="view" onClick={() => navigate(`/ebooks/${item.id}`)}>
                    查看
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<ReadOutlined />} style={{ background: '#13c2c2' }} />}
                  title={item.title}
                  description={
                    <div>
                      <Tag color="cyan">¥{item.price}</Tag>
                      <Tag>{item.fileType}</Tag>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </Spin>

      <Modal
        title="发布专栏"
        open={columnModalVisible}
        onOk={handleCreateColumn}
        onCancel={() => setColumnModalVisible(false)}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={columnForm} layout="vertical">
          <Form.Item name="title" label="专栏标题" rules={[{ required: true }]}>
            <Input placeholder="请输入专栏标题" />
          </Form.Item>
          <Form.Item name="description" label="专栏简介" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="请输入专栏简介" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="编程开发">编程开发</Select.Option>
              <Select.Option value="设计创意">设计创意</Select.Option>
              <Select.Option value="商业管理">商业管理</Select.Option>
              <Select.Option value="语言学习">语言学习</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="monthlyPrice" label="月付价格" rules={[{ required: true }]}>
            <Input type="number" placeholder="请输入月付价格" />
          </Form.Item>
          <Form.Item name="quarterlyPrice" label="季付价格" rules={[{ required: true }]}>
            <Input type="number" placeholder="请输入季付价格" />
          </Form.Item>
          <Form.Item name="yearlyPrice" label="年付价格" rules={[{ required: true }]}>
            <Input type="number" placeholder="请输入年付价格" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发布音频课程"
        open={audioModalVisible}
        onOk={handleCreateAudio}
        onCancel={() => setAudioModalVisible(false)}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={audioForm} layout="vertical">
          <Form.Item name="title" label="课程标题" rules={[{ required: true }]}>
            <Input placeholder="请输入课程标题" />
          </Form.Item>
          <Form.Item name="description" label="课程简介" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="请输入课程简介" />
          </Form.Item>
          <Form.Item name="price" label="价格" rules={[{ required: true }]}>
            <Input type="number" placeholder="请输入价格" />
          </Form.Item>
          <Form.Item name="isSeries" label="是否为系列课" rules={[{ required: true }]}>
            <Select>
              <Select.Option value={true}>是（多集系列）</Select.Option>
              <Select.Option value={false}>否（单集）</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发布电子书"
        open={ebookModalVisible}
        onOk={handleCreateEbook}
        onCancel={() => setEbookModalVisible(false)}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={ebookForm} layout="vertical">
          <Form.Item name="title" label="书名" rules={[{ required: true }]}>
            <Input placeholder="请输入书名" />
          </Form.Item>
          <Form.Item name="description" label="简介" rules={[{ required: true }]}>
            <TextArea rows={4} placeholder="请输入书籍简介" />
          </Form.Item>
          <Form.Item name="price" label="价格" rules={[{ required: true }]}>
            <Input type="number" placeholder="请输入价格" />
          </Form.Item>
          <Form.Item name="fileType" label="文件格式" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="PDF">PDF</Select.Option>
              <Select.Option value="EPUB">EPUB</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`文章管理 · ${articleDrawerColumn?.title || ''}`}
        open={!!articleDrawerColumn}
        onClose={() => setArticleDrawerColumn(null)}
        width={640}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setArticleModalVisible(true)}>
            新建文章
          </Button>
        }
      >
        <Spin spinning={articlesLoading}>
          <List
            dataSource={articles}
            locale={{ emptyText: '还没有文章，点击右上角新建' }}
            renderItem={(article) => (
              <List.Item actions={renderArticleActions(article)}>
                <List.Item.Meta
                  title={
                    <Space>
                      <span>#{article.sequence}</span>
                      {article.title}
                      {renderArticleStatus(article)}
                    </Space>
                  }
                  description={article.summary}
                />
              </List.Item>
            )}
          />
        </Spin>
      </Drawer>

      <Modal
        title="新建文章"
        open={articleModalVisible}
        onOk={handleCreateArticle}
        onCancel={() => setArticleModalVisible(false)}
        confirmLoading={articleSubmitting}
        width={640}
        okText="保存"
        cancelText="取消"
      >
        <Form form={articleForm} layout="vertical">
          <Form.Item name="title" label="文章标题" rules={[{ required: true, message: '请输入文章标题' }]}>
            <Input placeholder="请输入文章标题" />
          </Form.Item>
          <Form.Item name="summary" label="摘要">
            <TextArea rows={2} placeholder="请输入摘要（可选）" />
          </Form.Item>
          <Form.Item name="content" label="正文" rules={[{ required: true, message: '请输入正文' }]}>
            <TextArea rows={8} placeholder="请输入正文" />
          </Form.Item>
          <Form.Item name="sequence" label="排序号">
            <Input type="number" placeholder="留空则自动排在最后" />
          </Form.Item>
          <Form.Item
            name="scheduledAt"
            label="预约上线时间"
            extra="不填则保存后立即上线；填写后到点自动上线，上线前仅自己可见"
          >
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
              disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))}
              placeholder="选择预约上线时间（可选）"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={rescheduleArticle?.status === 'SCHEDULED' ? '修改预约时间' : '预约上线'}
        open={!!rescheduleArticle}
        onOk={handleReschedule}
        onCancel={() => {
          setRescheduleArticle(null)
          setRescheduleTime(null)
        }}
        confirmLoading={rescheduleSubmitting}
        okText="确定"
        cancelText="取消"
      >
        <p>文章：{rescheduleArticle?.title}</p>
        <DatePicker
          showTime={{ format: 'HH:mm' }}
          format="YYYY-MM-DD HH:mm"
          style={{ width: '100%' }}
          value={rescheduleTime}
          onChange={(value) => setRescheduleTime(value)}
          disabledDate={(current) => current && current.isBefore(dayjs().startOf('day'))}
          placeholder="选择新的上线时间"
        />
      </Modal>
    </div>
  )
}

export default CreatorDashboard
