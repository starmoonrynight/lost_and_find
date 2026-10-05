{
  id: 'uuid',
  type: 'lost' | 'found',  // 寻物启事 / 失物招领
  title: '',
  category: '证件' | '电子产品' | ...,
  description: '',
  location: '',
  date: 'YYYY-MM-DD',
  contact: '',
  contactType: 'wechat'|'phone'|'email'|'qq',
  image: '' (dataURL or url),
  status: 'open' | 'closed',
  createdAt: timestamp
}
