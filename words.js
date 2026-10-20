/* ===================================================================
 * 刷六级 · 词库（示例集，60 个六级高频词）
 * -------------------------------------------------------------------
 * 字段：
 *   id   唯一键（= 单词小写）
 *   w    单词
 *   ipa  音标（英式）
 *   pos  词性
 *   cn   中文释义数组（1–3 条，每条 ≤ 12 字）
 *   ex   例句（≤ 14 词，贴近六级语域）
 *   exCn 例句译文
 *   root 词根 / 助记（≤ 20 字）
 *   lvl  1 = 核心高频，2 = 大纲词，3 = 拔高
 *   rank 词频排序（越小越先学）
 *
 * 想加词：复制一条，改字段即可（id 不能重复）。
 * 注意：字符串用双引号，内部不要再出现双引号。
 * =================================================================== */

const CET6_WORDS = [
  {
    id: "abandon", w: "abandon", ipa: "/əˈbændən/", pos: "v.",
    cn: ["放弃", "抛弃"],
    ex: "They abandoned the plan after the funding was cut.",
    exCn: "资金被削减后，他们放弃了这个计划。",
    root: "a-（去）+ bandon（控制）→ 交出控制权 → 放弃",
    lvl: 1, rank: 1
  },
  {
    id: "abolish", w: "abolish", ipa: "/əˈbɒlɪʃ/", pos: "v.",
    cn: ["废除", "取消"],
    ex: "The new law abolishes the old tax system.",
    exCn: "新法律废除了旧的税收制度。",
    root: "ab-（离开）+ ol（生长）→ 使其不再生长 → 废除",
    lvl: 1, rank: 2
  },
  {
    id: "absorb", w: "absorb", ipa: "/əbˈzɔːb/", pos: "v.",
    cn: ["吸收", "使专心"],
    ex: "Plants absorb carbon dioxide from the air.",
    exCn: "植物从空气中吸收二氧化碳。",
    root: "ab-（去）+ sorb（吸）→ 吸进去",
    lvl: 1, rank: 3
  },
  {
    id: "abstract", w: "abstract", ipa: "/ˈæbstrækt/", pos: "adj./n.",
    cn: ["抽象的", "摘要"],
    ex: "The concept is too abstract for beginners.",
    exCn: "这个概念对初学者来说太抽象了。",
    root: "abs-（离开）+ tract（拉）→ 从具体中拉出来 → 抽象",
    lvl: 1, rank: 4
  },
  {
    id: "accelerate", w: "accelerate", ipa: "/əkˈseləreɪt/", pos: "v.",
    cn: ["加速", "促进"],
    ex: "The car accelerated as it left the city.",
    exCn: "汽车驶出城市时加速了。",
    root: "ac-（加强）+ celer（快）+ -ate → 使变快",
    lvl: 1, rank: 5
  },
  {
    id: "accommodate", w: "accommodate", ipa: "/əˈkɒmədeɪt/", pos: "v.",
    cn: ["容纳", "适应"],
    ex: "The hall can accommodate up to 500 people.",
    exCn: "这个大厅最多可以容纳 500 人。",
    root: "ac-（向）+ commod（合适）+ -ate → 使合适 → 容纳",
    lvl: 1, rank: 6
  },
  {
    id: "accumulate", w: "accumulate", ipa: "/əˈkjuːmjəleɪt/", pos: "v.",
    cn: ["积累", "积聚"],
    ex: "Dust had accumulated on the shelves over the years.",
    exCn: "多年来架子上积满了灰尘。",
    root: "ac-（向）+ cumul（堆）+ -ate → 堆起来",
    lvl: 1, rank: 7
  },
  {
    id: "acknowledge", w: "acknowledge", ipa: "/əkˈnɒlɪdʒ/", pos: "v.",
    cn: ["承认", "致谢"],
    ex: "He acknowledged that the mistake was his.",
    exCn: "他承认这个错误是他的。",
    root: "ac-（加强）+ knowledge（知道）→ 公开知道 → 承认",
    lvl: 1, rank: 8
  },
  {
    id: "adequate", w: "adequate", ipa: "/ˈædɪkwət/", pos: "adj.",
    cn: ["足够的", "适当的"],
    ex: "The room was small but adequate for one person.",
    exCn: "房间不大，但一个人住足够了。",
    root: "ad-（向）+ equ（相等）+ -ate → 与需求相等 → 足够",
    lvl: 1, rank: 9
  },
  {
    id: "adjacent", w: "adjacent", ipa: "/əˈdʒeɪsnt/", pos: "adj.",
    cn: ["邻近的", "毗连的"],
    ex: "Our office is adjacent to the library.",
    exCn: "我们的办公室紧邻图书馆。",
    root: "ad-（向）+ jac（躺）+ -ent → 躺在旁边 → 相邻",
    lvl: 1, rank: 10
  },
  {
    id: "advocate", w: "advocate", ipa: "/ˈædvəkeɪt/", pos: "v./n.",
    cn: ["提倡", "拥护者"],
    ex: "Many experts advocate a shorter working week.",
    exCn: "许多专家提倡缩短每周的工作时间。",
    root: "ad-（向）+ voc（叫）+ -ate → 为某事发声 → 提倡",
    lvl: 1, rank: 11
  },
  {
    id: "aesthetic", w: "aesthetic", ipa: "/iːsˈθetɪk/", pos: "adj.",
    cn: ["美学的", "审美的"],
    ex: "The old building has great aesthetic value.",
    exCn: "这座老建筑有很高的美学价值。",
    root: "源自希腊语 aisthetikos（感知）→ 与美感有关",
    lvl: 1, rank: 12
  },
  {
    id: "allocate", w: "allocate", ipa: "/ˈæləkeɪt/", pos: "v.",
    cn: ["分配", "拨给"],
    ex: "The school allocated more funds to science.",
    exCn: "学校给理科分配了更多资金。",
    root: "al-（向）+ loc（地方）+ -ate → 分到各个地方",
    lvl: 1, rank: 13
  },
  {
    id: "ambiguous", w: "ambiguous", ipa: "/æmˈbɪɡjuəs/", pos: "adj.",
    cn: ["模棱两可的", "含糊的"],
    ex: "The wording of the contract is deliberately ambiguous.",
    exCn: "合同的措辞故意含糊其辞。",
    root: "ambi-（两边）+ ag（走）→ 两边都能走 → 含糊",
    lvl: 1, rank: 14
  },
  {
    id: "anticipate", w: "anticipate", ipa: "/ænˈtɪsɪpeɪt/", pos: "v.",
    cn: ["预料", "期望"],
    ex: "We anticipate a rise in demand next year.",
    exCn: "我们预计明年需求会上升。",
    root: "anti-（提前）+ cip（拿）+ -ate → 提前拿到 → 预料",
    lvl: 1, rank: 15
  },
  {
    id: "arbitrary", w: "arbitrary", ipa: "/ˈɑːbɪtrəri/", pos: "adj.",
    cn: ["任意的", "武断的"],
    ex: "The decision seemed arbitrary and unfair.",
    exCn: "这个决定显得武断而不公平。",
    root: "arbitr（裁决）+ -ary → 由裁决者随意定 → 武断",
    lvl: 1, rank: 16
  },
  {
    id: "assess", w: "assess", ipa: "/əˈses/", pos: "v.",
    cn: ["评估", "估价"],
    ex: "It is difficult to assess the damage.",
    exCn: "很难评估损失。",
    root: "as-（向）+ sess（坐）→ 坐在旁边审 → 评估",
    lvl: 1, rank: 17
  },
  {
    id: "assume", w: "assume", ipa: "/əˈsjuːm/", pos: "v.",
    cn: ["假定", "承担"],
    ex: "Let us assume that the report is correct.",
    exCn: "我们不妨假定这份报告是正确的。",
    root: "as-（向）+ sum（拿）→ 拿过来当真 → 假定",
    lvl: 1, rank: 18
  },
  {
    id: "attribute", w: "attribute", ipa: "/əˈtrɪbjuːt/", pos: "v./n.",
    cn: ["把…归因于", "属性"],
    ex: "She attributes her success to hard work.",
    exCn: "她把自己的成功归因于努力。",
    root: "at-（向）+ tribut（给予）→ 把原因给到某处",
    lvl: 1, rank: 19
  },
  {
    id: "authentic", w: "authentic", ipa: "/ɔːˈθentɪk/", pos: "adj.",
    cn: ["真实的", "正宗的"],
    ex: "The museum displays authentic ancient coins.",
    exCn: "博物馆展出真正的古钱币。",
    root: "auth（自身/原作者）+ -entic → 出自本人的 → 真实",
    lvl: 1, rank: 20
  },
  {
    id: "bias", w: "bias", ipa: "/ˈbaɪəs/", pos: "n./v.",
    cn: ["偏见", "使有偏见"],
    ex: "The report shows a clear bias against migrants.",
    exCn: "这份报告对移民有明显偏见。",
    root: "源自古法语 biais（斜）→ 看偏了 → 偏见",
    lvl: 1, rank: 21
  },
  {
    id: "boost", w: "boost", ipa: "/buːst/", pos: "v./n.",
    cn: ["促进", "提高"],
    ex: "The policy aims to boost consumer spending.",
    exCn: "该政策旨在促进消费。",
    root: "俚语来源，意为从下面往上推 → 提升",
    lvl: 1, rank: 22
  },
  {
    id: "capacity", w: "capacity", ipa: "/kəˈpæsəti/", pos: "n.",
    cn: ["容量", "能力"],
    ex: "The stadium has a capacity of 80,000.",
    exCn: "这座体育场可以容纳 8 万人。",
    root: "cap（拿）+ -acity → 能装下的量 → 容量",
    lvl: 1, rank: 23
  },
  {
    id: "cease", w: "cease", ipa: "/siːs/", pos: "v.",
    cn: ["停止", "终止"],
    ex: "The factory ceased production last month.",
    exCn: "工厂上个月停止了生产。",
    root: "拉丁语 cessare（停）→ 停止",
    lvl: 1, rank: 24
  },
  {
    id: "coherent", w: "coherent", ipa: "/kəʊˈhɪərənt/", pos: "adj.",
    cn: ["连贯的", "一致的"],
    ex: "Her essay is clear and coherent.",
    exCn: "她的文章清晰而连贯。",
    root: "co-（共同）+ her（粘）+ -ent → 粘在一起 → 连贯",
    lvl: 1, rank: 25
  },
  {
    id: "collapse", w: "collapse", ipa: "/kəˈlæps/", pos: "v./n.",
    cn: ["倒塌", "崩溃"],
    ex: "The bridge collapsed during the storm.",
    exCn: "这座桥在暴风雨中倒塌了。",
    root: "col-（一起）+ laps（滑落）→ 一起滑下去 → 倒塌",
    lvl: 1, rank: 26
  },
  {
    id: "compensate", w: "compensate", ipa: "/ˈkɒmpenseɪt/", pos: "v.",
    cn: ["补偿", "弥补"],
    ex: "Nothing can compensate for the loss of a friend.",
    exCn: "失去朋友的损失是任何东西都无法弥补的。",
    root: "com-（共同）+ pens（称重）+ -ate → 两边称平 → 补偿",
    lvl: 1, rank: 27
  },
  {
    id: "compel", w: "compel", ipa: "/kəmˈpel/", pos: "v.",
    cn: ["强迫", "迫使"],
    ex: "Bad weather compelled us to stay indoors.",
    exCn: "恶劣的天气迫使我们待在室内。",
    root: "com-（加强）+ pel（推）→ 使劲推 → 强迫",
    lvl: 1, rank: 28
  },
  {
    id: "comply", w: "comply", ipa: "/kəmˈplaɪ/", pos: "v.",
    cn: ["遵守", "服从"],
    ex: "All staff must comply with the safety rules.",
    exCn: "所有员工都必须遵守安全规定。",
    root: "com-（完全）+ ply（填满）→ 完全满足要求 → 遵守",
    lvl: 1, rank: 29
  },
  {
    id: "comprehensive", w: "comprehensive", ipa: "/ˌkɒmprɪˈhensɪv/", pos: "adj.",
    cn: ["全面的", "综合的"],
    ex: "The book offers a comprehensive introduction to physics.",
    exCn: "这本书提供了物理学的全面入门介绍。",
    root: "com-（全部）+ prehend（抓住）+ -ive → 全抓住 → 全面",
    lvl: 1, rank: 30
  },
  {
    id: "compromise", w: "compromise", ipa: "/ˈkɒmprəmaɪz/", pos: "n./v.",
    cn: ["妥协", "危及"],
    ex: "Both sides finally agreed to a compromise.",
    exCn: "双方最终同意妥协。",
    root: "com-（共同）+ promise（承诺）→ 各让一步 → 妥协",
    lvl: 1, rank: 31
  },
  {
    id: "conceive", w: "conceive", ipa: "/kənˈsiːv/", pos: "v.",
    cn: ["构想", "设想"],
    ex: "It is hard to conceive of a world without the internet.",
    exCn: "很难想象一个没有互联网的世界。",
    root: "con-（完全）+ ceive（拿）→ 完整地拿到心里 → 构想",
    lvl: 1, rank: 32
  },
  {
    id: "confront", w: "confront", ipa: "/kənˈfrʌnt/", pos: "v.",
    cn: ["面对", "对抗"],
    ex: "The country is confronting a serious energy crisis.",
    exCn: "这个国家正面临严重的能源危机。",
    root: "con-（共同）+ front（前额）→ 面对面 → 对抗",
    lvl: 1, rank: 33
  },
  {
    id: "consensus", w: "consensus", ipa: "/kənˈsensəs/", pos: "n.",
    cn: ["共识", "一致意见"],
    ex: "The committee reached a consensus on the plan.",
    exCn: "委员会就该计划达成了一致意见。",
    root: "con-（共同）+ sens（感觉）→ 共同的感觉 → 共识",
    lvl: 1, rank: 34
  },
  {
    id: "consequence", w: "consequence", ipa: "/ˈkɒnsɪkwəns/", pos: "n.",
    cn: ["结果", "后果"],
    ex: "He ignored the consequences of his actions.",
    exCn: "他忽视了自己行为的后果。",
    root: "con-（一起）+ sequ（跟随）+ -ence → 跟着来的东西",
    lvl: 1, rank: 35
  },
  {
    id: "considerable", w: "considerable", ipa: "/kənˈsɪdərəbl/", pos: "adj.",
    cn: ["相当大的", "可观的"],
    ex: "The project required a considerable amount of time.",
    exCn: "这个项目需要相当多的时间。",
    root: "consider（考虑）+ -able → 值得考虑的量 → 相当大",
    lvl: 1, rank: 36
  },
  {
    id: "constitute", w: "constitute", ipa: "/ˈkɒnstɪtjuːt/", pos: "v.",
    cn: ["构成", "组成"],
    ex: "Women constitute half of the workforce.",
    exCn: "女性占劳动力的一半。",
    root: "con-（共同）+ stitute（建立）→ 共同建立 → 构成",
    lvl: 1, rank: 37
  },
  {
    id: "constrain", w: "constrain", ipa: "/kənˈstreɪn/", pos: "v.",
    cn: ["限制", "约束"],
    ex: "Limited funds constrain what we can do.",
    exCn: "有限的资金限制了我们的做法。",
    root: "con-（一起）+ strain（拉紧）→ 捆紧 → 限制",
    lvl: 1, rank: 38
  },
  {
    id: "consume", w: "consume", ipa: "/kənˈsjuːm/", pos: "v.",
    cn: ["消耗", "消费"],
    ex: "The new machine consumes much less energy.",
    exCn: "这台新机器消耗的能源少得多。",
    root: "con-（完全）+ sume（拿）→ 全部拿走 → 消耗",
    lvl: 1, rank: 39
  },
  {
    id: "contemporary", w: "contemporary", ipa: "/kənˈtemprəri/", pos: "adj./n.",
    cn: ["当代的", "同代人"],
    ex: "The gallery shows contemporary Chinese art.",
    exCn: "这家美术馆展出中国当代艺术。",
    root: "con-（共同）+ tempor（时间）+ -ary → 同一时代",
    lvl: 1, rank: 40
  },
  {
    id: "contradict", w: "contradict", ipa: "/ˌkɒntrəˈdɪkt/", pos: "v.",
    cn: ["反驳", "与…矛盾"],
    ex: "His actions contradict his words.",
    exCn: "他的行为与他的言语相矛盾。",
    root: "contra-（相反）+ dict（说）→ 说相反的话",
    lvl: 1, rank: 41
  },
  {
    id: "controversial", w: "controversial", ipa: "/ˌkɒntrəˈvɜːʃl/", pos: "adj.",
    cn: ["有争议的"],
    ex: "The plan remains highly controversial.",
    exCn: "该计划仍然极具争议。",
    root: "contro-（相反）+ vers（转）+ -ial → 转向对立面",
    lvl: 1, rank: 42
  },
  {
    id: "crucial", w: "crucial", ipa: "/ˈkruːʃl/", pos: "adj.",
    cn: ["关键的", "至关重要的"],
    ex: "Sleep is crucial to good health.",
    exCn: "睡眠对健康至关重要。",
    root: "cruc（十字）→ 十字路口 → 决定性的",
    lvl: 1, rank: 43
  },
  {
    id: "cumulative", w: "cumulative", ipa: "/ˈkjuːmjələtɪv/", pos: "adj.",
    cn: ["累积的"],
    ex: "The cumulative effect of small changes is huge.",
    exCn: "小变化的累积效应是巨大的。",
    root: "cumul（堆）+ -ative → 一点点堆起来",
    lvl: 1, rank: 44
  },
  {
    id: "decline", w: "decline", ipa: "/dɪˈklaɪn/", pos: "v./n.",
    cn: ["下降", "拒绝"],
    ex: "Sales declined sharply last quarter.",
    exCn: "上季度销售额急剧下降。",
    root: "de-（向下）+ clin（倾斜）→ 向下倾 → 下降",
    lvl: 1, rank: 45
  },
  {
    id: "dedicate", w: "dedicate", ipa: "/ˈdedɪkeɪt/", pos: "v.",
    cn: ["献身", "致力于"],
    ex: "She dedicated her life to science.",
    exCn: "她把一生献给了科学。",
    root: "de-（加强）+ dic（说）+ -ate → 郑重宣告 → 奉献",
    lvl: 1, rank: 46
  },
  {
    id: "deficit", w: "deficit", ipa: "/ˈdefɪsɪt/", pos: "n.",
    cn: ["赤字", "不足"],
    ex: "The government is trying to cut the deficit.",
    exCn: "政府正设法削减赤字。",
    root: "de-（不）+ fic（做）→ 没做够 → 缺口",
    lvl: 1, rank: 47
  },
  {
    id: "deliberate", w: "deliberate", ipa: "/dɪˈlɪbərət/", pos: "adj.",
    cn: ["故意的", "深思熟虑的"],
    ex: "The damage was clearly deliberate.",
    exCn: "这处损坏显然是故意的。",
    root: "de-（加强）+ liber（称量）+ -ate → 反复称量 → 深思",
    lvl: 1, rank: 48
  },
  {
    id: "demonstrate", w: "demonstrate", ipa: "/ˈdemənstreɪt/", pos: "v.",
    cn: ["证明", "演示"],
    ex: "The study demonstrates a link between diet and health.",
    exCn: "这项研究证明了饮食与健康之间的联系。",
    root: "de-（加强）+ monstr（显示）+ -ate → 显示出来",
    lvl: 1, rank: 49
  },
  {
    id: "deprive", w: "deprive", ipa: "/dɪˈpraɪv/", pos: "v.",
    cn: ["剥夺", "使丧失"],
    ex: "The children were deprived of education.",
    exCn: "这些孩子被剥夺了受教育的机会。",
    root: "de-（去掉）+ priv（私人）→ 把人私有的东西拿走",
    lvl: 1, rank: 50
  },
  {
    id: "deteriorate", w: "deteriorate", ipa: "/dɪˈtɪəriəreɪt/", pos: "v.",
    cn: ["恶化", "变坏"],
    ex: "Her health deteriorated rapidly after the operation.",
    exCn: "手术后她的健康状况迅速恶化。",
    root: "deterior（更坏的）+ -ate → 变得更坏",
    lvl: 1, rank: 51
  },
  {
    id: "diminish", w: "diminish", ipa: "/dɪˈmɪnɪʃ/", pos: "v.",
    cn: ["减少", "削弱"],
    ex: "Our energy diminished as the day went on.",
    exCn: "随着一天过去，我们的精力减弱了。",
    root: "di- + min（小）+ -ish → 变小 → 减少",
    lvl: 1, rank: 52
  },
  {
    id: "discard", w: "discard", ipa: "/dɪsˈkɑːd/", pos: "v.",
    cn: ["丢弃", "抛弃"],
    ex: "Please discard used batteries properly.",
    exCn: "请妥善丢弃废旧电池。",
    root: "dis-（去掉）+ card（纸牌）→ 把牌扔掉",
    lvl: 1, rank: 53
  },
  {
    id: "discriminate", w: "discriminate", ipa: "/dɪˈskrɪmɪneɪt/", pos: "v.",
    cn: ["歧视", "区分"],
    ex: "It is illegal to discriminate on grounds of age.",
    exCn: "以年龄为由进行歧视是违法的。",
    root: "dis-（分开）+ crimin（区分）+ -ate → 区别对待",
    lvl: 1, rank: 54
  },
  {
    id: "dispute", w: "dispute", ipa: "/dɪˈspjuːt/", pos: "n./v.",
    cn: ["争论", "纠纷"],
    ex: "The two sides are in dispute over the land.",
    exCn: "双方就这块土地存在争议。",
    root: "dis-（分开）+ pute（想）→ 想法分开 → 争执",
    lvl: 1, rank: 55
  },
  {
    id: "distinct", w: "distinct", ipa: "/dɪˈstɪŋkt/", pos: "adj.",
    cn: ["明显的", "不同的"],
    ex: "There are two distinct types of learner.",
    exCn: "有两类明显不同的学习者。",
    root: "di-（分开）+ stinct（刺）→ 刺出来 → 显眼、不同",
    lvl: 1, rank: 56
  },
  {
    id: "diverse", w: "diverse", ipa: "/daɪˈvɜːs/", pos: "adj.",
    cn: ["多样的", "不同的"],
    ex: "The city has a diverse population.",
    exCn: "这座城市的人口构成非常多样。",
    root: "di-（分开）+ vers（转）→ 转向不同方向 → 多样",
    lvl: 1, rank: 57
  },
  {
    id: "dominate", w: "dominate", ipa: "/ˈdɒmɪneɪt/", pos: "v.",
    cn: ["支配", "占主导"],
    ex: "A few firms dominate the market.",
    exCn: "少数几家公司主导着市场。",
    root: "domin（主人）+ -ate → 像主人一样 → 支配",
    lvl: 1, rank: 58
  },
  {
    id: "eliminate", w: "eliminate", ipa: "/ɪˈlɪmɪneɪt/", pos: "v.",
    cn: ["消除", "淘汰"],
    ex: "The new system eliminates most paperwork.",
    exCn: "新系统消除了大部分纸质工作。",
    root: "e-（出）+ limin（门槛）+ -ate → 赶出门外 → 消除",
    lvl: 1, rank: 59
  },
  {
    id: "emerge", w: "emerge", ipa: "/ɪˈmɜːdʒ/", pos: "v.",
    cn: ["出现", "显露"],
    ex: "New evidence has emerged in the case.",
    exCn: "案件中出现了新的证据。",
    root: "e-（出）+ merge（沉）→ 从沉没中出来 → 浮现",
    lvl: 1, rank: 60
  }
];
