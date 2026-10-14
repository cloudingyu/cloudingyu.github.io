/** Editorial term weights for the first reading experiment. */
export const READING_EMPHASIS = {
  '从数学推导看机器学习的激活函数与损失函数': {
    primary: [
      '激活函数', '损失函数', '负对数似然', '线性回归', '二分类', '多分类',
      '独立同分布', '最大化似然', '梯度下降', '均方误差', '二元交叉熵',
      '交叉熵', '线性激活', '伯努利分布', '高斯分布', '类别分布',
      '反向传播', '链式法则', '末层梯度', '核心误差',
    ],
    secondary: [
      '机器学习', '似然函数', '似然', '概率', '模型参数', '观测数据',
      '数值下溢', '取对数', '输出空间', '概率模型', '连续实数', '连续的实数',
      '预测值', '梯度', '参数', '实数域', '导数', '约束', '输出范围',
      '因此', '由于', '所以', '等价于', '也就是说', '本质是因为', '不仅',
      '正是', '可见', '最终得到', '同时',
    ],
  },
};

/** Only complete, usable word lists enable enhanced reading. */
export function getReadingEmphasis(title) {
  const profile = Object.hasOwn(READING_EMPHASIS, title ?? '') ? READING_EMPHASIS[title] : null;
  if (!profile || !Array.isArray(profile.primary) || !profile.primary.length
    || !Array.isArray(profile.secondary)) return null;
  const terms = [...profile.primary, ...profile.secondary];
  if (terms.some(term => typeof term !== 'string' || !term.trim() || term !== term.trim())
    || new Set(terms).size !== terms.length) return null;
  return profile;
}
