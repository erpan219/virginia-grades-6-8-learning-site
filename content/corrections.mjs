// Reviewed replacements for existing content. Record and option indices stay stable.
export const correctionTitles = {
  6: 'Theme & Main Idea',
  11: 'Scientific Investigation',
  23: 'Two-Step Equations',
  30: 'Comparing Texts & Media',
  34: 'DNA, Genes & Heredity',
  61: 'Rights, Responsibilities & Voting',
  63: 'Economics & Personal Finance',
  66: 'Linear Functions'
};

export const corrections = [
  {
    lesson: 6, field: ['ex'],
    reason: 'The existing example calls “a race” the main idea, confusing a topic with a complete main-idea statement.',
    value: ["In 'The Tortoise and the Hare,' the topic is a race. A main-idea statement is: <b>a steady tortoise defeats an overconfident hare in a race</b>. A supported theme is: <b>steady effort can succeed where overconfidence fails</b>. The theme applies beyond this particular race.", "在《龟兔赛跑》中，话题是一场比赛。中心思想可以表述为：<b>坚持前进的乌龟在比赛中战胜了过度自信的兔子</b>。有依据的主题是：<b>坚持努力能取得成功，过度自信却可能导致失败</b>。主题的意义超出了这场具体比赛。"]
  },
  {
    lesson: 23, field: ['q', 6, 0], reason: 'Dividing every term by 6 is valid, even if subtracting first is simpler.',
    value: 'To solve 6x + 2 = 20, Zoe correctly divides every term by 6. Why might subtracting 2 first be a simpler choice?'
  },
  { lesson: 23, field: ['q', 6, 1], value: '解 6x + 2 = 20 时，佐伊正确地把每一项都除以 6。为什么先减 2 可能更简便？' },
  { lesson: 23, field: ['q', 6, 4], value: 'Both methods are valid. Dividing every term gives x + 1/3 = 10/3, then x = 3. Subtracting 2 first gives 6x = 18, then x = 3, without fractions.' },
  { lesson: 23, field: ['q', 6, 5], value: '两种方法都正确。每一项除以 6 得 x + 1/3 = 10/3，再得 x = 3。先减 2 得 6x = 18，再得 x = 3，可以避免分数。' },
  { lesson: 23, field: ['q', 6, 6], value: 'Compare the intermediate numbers. A less convenient step can still be mathematically correct.' },
  { lesson: 23, field: ['q', 6, 7], value: '比较中间步骤的数字。不够简便的一步，数学上仍可能正确。' },
  {
    lesson: 34, field: ['bg', 0], reason: 'Qualify the complete-dominance model; use allele rather than “copy of the gene.”',
    value: ['In a simple complete-dominance model, one dominant allele is enough for the dominant phenotype to appear. A recessive phenotype appears when both alleles are recessive. A carrier can pass on a recessive allele without showing that phenotype. This model describes some inheritance patterns, not every trait.', '在简单的完全显性模型中，一个显性等位基因就足以使显性性状表现。两个等位基因都为隐性时，隐性性状才表现。携带者可以不表现隐性性状，却仍把隐性等位基因传给后代。这个模型描述一些遗传方式，并不适用于每一种性状。']
  },
  {
    lesson: 34, field: ['bg', 1], reason: 'Human eye color is polygenic; the original brown-eye/blue-eye hidden-copy explanation incorrectly presents a single-gene model.',
    value: ['Many human traits, including eye color, involve multiple genes. Simple Punnett squares help us learn probability for a defined one-gene model; they cannot predict every feature of a real person. Breeders also study inheritance when selecting traits in plants and animals.', '许多人类性状，包括眼睛颜色，都涉及多个基因。简单的庞氏方格有助于学习特定单基因模型中的概率，但不能预测真实人物的所有特征。育种者在选择植物和动物性状时，也会研究遗传。']
  },
  {
    lesson: 34, field: ['v', 2], reason: 'Retain card index 34_2 and term while making its definition accurate within the stated model.',
    value: ['dominant', '显性的', 'Describes an allele expressed in the phenotype when one copy is present, in a complete-dominance model. It does not mean more common or better.', '在完全显性模型中，指一份就能在表现型中体现的等位基因；不表示更常见或更好。']
  }
];

// Each pooled prompt must supply its own setup in both languages.
const plantSetup = [
  'A student changes the hours of sunlight for otherwise similar plants, keeps water, soil, and pot size the same, and measures their final heights after two weeks.',
  '一名学生改变其他条件相似的植物每天接受阳光的时长，保持水量、土壤和花盆大小相同，并在两周后测量植物的最终高度。'
];
for (const [qi, en, zh] of [
  [0, 'To make this a fair test of sunlight, which conditions should stay the same?', '为了公平地研究光照的作用，哪些条件应保持不变？'],
  [2, 'The hours of sunlight are the…', '接受阳光的时长是……'],
  [3, 'The final plant height is the…', '植物的最终高度是……']
]) {
  corrections.push(
    { lesson: 11, field: ['q', qi, 0], value: `${plantSetup[0]} ${en}`, reason: 'The question can be drawn independently into a Challenge or exam.' },
    { lesson: 11, field: ['q', qi, 1], value: `${plantSetup[1]}${zh}` }
  );
}

const reviewedQuestionFields = [
  [30, 2, {
    0: 'Two articles repeat the same claim. Before treating their agreement as strong evidence, what should a reader do?',
    1: '两篇文章重复同一个说法。在把这种一致看作有力证据之前，读者应该做什么？',
    2: [['Trace the claim to its evidence and check whether the sources investigated it independently', '追溯说法的证据，并核查来源是否独立调查过'], ['Count the agreement as two confirmations, even if one article copied the other', '即使一篇抄了另一篇，也把一致算作两次证实'], ['Trust the longer article without checking where its information came from', '不核查信息出处，只相信较长的文章']],
    4: 'Agreement is stronger evidence when trustworthy sources reached it independently. Two articles can repeat the same unsupported claim, so trace the original evidence and check how each source obtained its information.',
    5: '可信来源独立得出一致结果时，证据才更有力。两篇文章可能重复同一个没有依据的说法，因此要追溯原始证据，并核查各来源怎样获得信息。',
    6: 'Ask where each article got its information. Two copies of one claim are not two independent checks.',
    7: '问每篇文章从哪里获得信息。同一个说法的两份副本，不等于两次独立核查。'
  }],
  [61, 5, {
    2: [['Ended slavery', '废除了奴隶制'], ['Barred denying U.S. citizens the vote because of their sex', '禁止因美国公民的性别而剥夺其投票权'], ['Set the voting age at 18', '把投票年龄定为 18 岁']],
    4: 'Ratified in 1920, the 19th Amendment barred federal and state governments from denying citizens the vote on account of sex. It did not remove every barrier: discriminatory voting laws continued to keep many women, especially women of color, from voting.',
    5: '1920 年批准的第十九修正案禁止联邦和州政府因公民的性别而剥夺其投票权。它没有消除所有障碍：歧视性的投票法律仍阻止许多女性，尤其是有色人种女性投票。',
    6: 'Distinguish a constitutional protection against sex discrimination from the removal of every obstacle to voting.',
    7: '区分宪法禁止性别歧视的保护，与消除一切投票障碍这两件事。'
  }],
  [66, 4, {
    0: 'An approximately normal (bell-shaped) data set has mean 10 and standard deviation 2. Which statement is most reasonable?',
    1: '一组近似正态分布（钟形）的数据，平均数为 10，标准差为 2。哪种说法最合理？',
    2: [['About 68% of the values lie between 8 and 12', '大约 68% 的值在 8 到 12 之间'], ['All values are exactly 2 away from 10', '所有值都恰好离 10 差 2'], ['The largest value is 12', '最大值是 12']],
    4: 'For approximately normal data, the empirical rule places about 68% of values within one standard deviation of the mean: 10 − 2 = 8 to 10 + 2 = 12. Mean and standard deviation alone do not justify this percentage for every distribution.',
    5: '对于近似正态分布的数据，经验法则指出约 68% 的值在平均数上下一个标准差内：从 10 − 2 = 8 到 10 + 2 = 12。仅凭平均数和标准差，不能对所有分布都断定这个比例。',
    6: 'Use the stated bell-shaped distribution and the empirical rule; then calculate the mean plus or minus one standard deviation.',
    7: '利用题目给出的钟形分布和经验法则，再计算平均数加减一个标准差。'
  }]
];
for (const [lesson, qi, fields] of reviewedQuestionFields) {
  for (const [field, value] of Object.entries(fields)) corrections.push({ lesson, field: ['q', qi, Number(field)], value });
}

corrections.push(
  {
    lesson: 30, field: ['bg', 0], reason: 'The lesson explanation must make the same independent-evidence distinction as its corrected question.',
    value: ['Compare not only what two texts claim but where their information came from. Agreement can increase confidence when trustworthy sources used independent evidence; copying the same unsupported claim does not confirm it. When accounts differ, examine their evidence, purposes, audiences, and the information available at the time.', '比较两篇文本时，不仅要比较主张，还要追查信息来源。可信来源使用独立证据而得出一致结论时，可信度可以提高；复制同一个没有依据的说法并不能证实它。叙述有差异时，应检查证据、目的、读者和当时可获得的信息。']
  },
  {
    lesson: 61, field: ['bg', 0], reason: 'Voting amendments are later amendments, not part of the first ten amendments in the Bill of Rights.',
    value: ['The Bill of Rights is the first ten amendments. It protects freedoms of expression (1st) and rights in the justice system (4th–8th), among others. Later voting amendments, including the 15th, 19th, and 26th, expanded constitutional protection for voting. Legal protections still needed enforcement against discriminatory barriers.', '《权利法案》是宪法的前十条修正案，保护表达自由（第一修正案）、司法系统中的权利（第四至第八修正案）等。之后的投票权修正案，包括第十五、第十九和第二十六修正案，扩大了宪法对投票权的保护。这些法律保护仍需要执行，才能克服歧视性障碍。']
  },
  {
    lesson: 66, field: ['bg', 0], reason: 'Constant changes in table outputs establish linearity only for equal input steps.',
    value: ['Three clues identify a linear function: its graph is a straight line, its equation can be written y = mx + b, and equal steps in a table’s x-values produce equal changes in y. The rate of change between any two points with different x-values is the same number — the slope.', '识别一次函数的三个线索是：图像是直线，方程能写成 y = mx + b，表格中 x 每次增加相同的量时，y 的变化量也相同。任意两个 x 值不同的点之间，变化率都是同一个数——斜率。']
  }
);

// Replace joke-like distractors with recognizable misconceptions; option IDs stay put.
const economicsOptions = [
  [0, 2, ['Stay the same because supply did not change', '因为供给没变，所以保持不变']],
  [1, 1, ['A record of past purchases with no plan for future spending', '只有过去消费记录，没有未来支出计划']],
  [1, 2, ['The largest amount a lender will let you borrow', '贷款人允许借入的最高金额']],
  [2, 2, ['Stay the same because demand did not change', '因为需求没变，所以保持不变']],
  [3, 2, ['The book she bought', '她买到的书']],
  [4, 2, ['Buyers want exactly as much as sellers offer at that price', '在那个价格下买家想要的恰好等于卖家提供的']],
  [5, 0, ['Spend first and save only whatever happens to remain', '先消费，只存碰巧剩下的钱']],
  [5, 2, ['Treat the credit-card limit as the amount available to spend', '把信用卡额度当作可以支出的金额']],
  [6, 2, ['Stay the same because the number of coats did not change', '因为外套数量没有变，所以价格保持不变']]
];
for (const [qi, oi, value] of economicsOptions) corrections.push({ lesson: 63, field: ['q', qi, 2, oi], value });

// Exact lesson:question:option keys are shared by lessons, Challenge and review.
export const correctionWrongReasons = {
  '30:2:1': ['Copying preserves one source, not an independent investigation. Check the original evidence before counting confirmations.', '复制仍来自同一个来源，不是独立调查。计算证实次数之前，应核查原始证据。'],
  '30:2:2': ['Length does not establish accuracy. A long article can repeat a claim without checking its evidence.', '篇幅不能证明准确性。长文章也可能未经证据核查就重复一个说法。'],
  '63:0:2': ['Unchanged supply does not cancel the effect of greater demand: more buyers compete for those goods.', '供给不变不能抵消需求增加的影响：更多买家会竞争这些商品。'],
  '63:1:1': ['Past spending records can inform a budget, but a budget also plans how future income will be spent and saved.', '过去的支出记录能帮助编制预算，但预算还要计划未来收入如何用于消费和储蓄。'],
  '63:1:2': ['A borrowing limit is a lender’s ceiling, not a plan based on your income, expenses, and savings goals.', '借款额度是贷款人设定的上限，不是根据收入、支出和储蓄目标制定的计划。'],
  '63:2:2': ['Unchanged demand does not cancel the effect of greater supply: sellers compete to sell the extra goods.', '需求不变不能抵消供给增加的影响：卖家会竞争出售多出的商品。'],
  '63:3:2': ['The book is the chosen benefit. The opportunity cost is the best alternative Maya gave up: the movie.', '书是所选的收益。机会成本是玛雅放弃的最好备选：看电影。'],
  '63:4:2': ['Equal quantities wanted and offered mean the market clears at that price; a shortage needs more wanted than offered.', '想买和愿卖的数量相等，表示市场在该价格下出清；短缺是想买的数量超过愿卖的数量。'],
  '63:5:0': ['Saving only leftovers can leave no regular savings. A plan reserves money for saving as well as spending.', '只存剩余的钱，可能无法定期储蓄。计划应同时为储蓄和消费预留资金。'],
  '63:5:2': ['A credit limit is borrowed money, not income or proof that the purchases are affordable. Budget for repayment and other needs.', '信用额度是借来的钱，不是收入，也不能证明买得起。预算还要考虑还款和其他需要。'],
  '63:6:2': ['The same number of coats now faces more demand, so buyers’ increased competition tends to raise prices.', '同样数量的外套面对更多需求，买家竞争加剧通常会推高价格。']
};
