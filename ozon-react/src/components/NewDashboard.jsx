import { useMemo, useState, useRef } from 'react'
import { TrendingUp, Eye, ShoppingCart, DollarSign, Package, Target, BarChart3, Sparkles, Star, Zap, Truck, Percent, Crown, Download } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, LineChart, Line, CartesianGrid, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const R = 0.09

const fmtCNY = (v) => {
  const cny = v * R
  if (cny >= 10000) return `${(cny / 10000).toFixed(1)}万`
  if (cny >= 1000) return `${(cny / 1000).toFixed(1)}K`
  return cny?.toFixed(0) || 0
}

const fmtCNYFull = (v) => {
  const cny = Math.round(v * R)
  return cny.toLocaleString()
}

const RUSSIAN_STOP_WORDS = new Set([
  'и', 'в', 'на', 'с', 'для', 'от', 'по', 'к', 'у', 'о', 'а', 'но', 'не', 'из', 'за', 'то', 'со', 'до', 'без',
  'как', 'что', 'это', 'все', 'он', 'она', 'они', 'мы', 'вы', 'его', 'ее', 'их', 'этот', 'тот', 'мой', 'ваш',
  'под', 'над', 'при', 'про', 'через', 'между', 'перед', 'после', 'вокруг', 'вдоль', 'возле', 'около',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
  'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'over',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any',
  'it', 'its', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his',
  'she', 'her', 'they', 'them', 'their', 'which', 'who', 'whom', 'what', 'where', 'when', 'how',
  'act', 'add', 'age', 'ago', 'aid', 'aim', 'any', 'app', 'ask', 'ate', 'awe',
  'bad', 'ban', 'bar', 'bat', 'bay', 'bet', 'big', 'bit', 'bow', 'boy', 'bud', 'bug', 'bus',
  'cab', 'cat', 'cup',
  'dab', 'dad', 'dam', 'day', 'did', 'dig', 'dim', 'dip', 'dot', 'due', 'dug',
  'ear', 'eat', 'egg', 'end', 'era', 'eve', 'eye',
  'far', 'fat', 'fed', 'few', 'fig', 'fin', 'fly', 'fog', 'fox', 'fun', 'fur',
  'gag', 'gap', 'gas', 'gem', 'get', 'gin', 'god', 'got', 'gum', 'gun', 'gut', 'guy', 'gym',
  'had', 'ham', 'has', 'hat', 'hay', 'hen', 'hid', 'him', 'hip', 'his', 'hit', 'hog', 'hop', 'how', 'hub', 'hue', 'hug', 'hum', 'hut',
  'ice', 'ill', 'imp', 'ink', 'inn', 'ion', 'ire', 'irk', 'ivy',
  'jab', 'jag', 'jaw', 'jay', 'jet', 'jig', 'job', 'jog', 'jot', 'joy', 'jug', 'jut',
  'keg', 'ken', 'kid', 'kin',
  'lab', 'lad', 'lag', 'lap', 'law', 'lay', 'lea', 'led', 'leg', 'let', 'lid', 'lie', 'lit', 'log', 'lot', 'low', 'lug',
  'mad', 'man', 'map', 'maw', 'may', 'men', 'met', 'mid', 'mob', 'mod', 'mom', 'mow', 'mud', 'mug', 'mum',
  'nab', 'nag', 'nap', 'nil', 'nod', 'nor', 'not', 'now', 'nun',
  'oak', 'oar', 'odd', 'ode', 'off', 'oft', 'ohm', 'old', 'one', 'opt', 'orb', 'ore', 'our', 'out', 'owe', 'owl', 'own',
  'pad', 'pal', 'pap', 'pat', 'paw', 'pay', 'pea', 'pep', 'per', 'pew', 'pie', 'pig', 'ply', 'pod', 'pop', 'pow', 'pro', 'pry', 'pub', 'pug', 'pun', 'pup', 'put',
  'rag', 'ram', 'ran', 'rap', 'rat', 'raw', 'ray', 'red', 'ref', 'rep', 'rev', 'rib', 'rid', 'rig', 'rim', 'rip', 'rob', 'rod', 'roe', 'rot', 'row', 'rub', 'rum', 'rut',
  'sac', 'sad', 'sag', 'sap', 'sat', 'saw', 'say', 'sea', 'sew', 'shy', 'sin', 'sip', 'sir', 'sis', 'sit', 'six', 'sky', 'sly', 'sob', 'sod', 'son', 'sop', 'sot', 'sow', 'soy', 'spy', 'sty', 'sub', 'sue', 'sum', 'sun', 'sup',
  'tab', 'tad', 'tag', 'tan', 'tar', 'tat', 'tax', 'tea', 'ten', 'thy', 'tic', 'tie', 'tip', 'toe', 'ton', 'too', 'top', 'tot', 'tow', 'toy', 'try', 'tug', 'two',
  'ugh', 'ump', 'uni', 'uns', 'ups', 'urb', 'use',
  'van', 'vat', 'vet', 'via', 'vie', 'vim', 'vow',
  'wad', 'wag', 'war', 'was', 'way', 'wed', 'wet', 'who', 'why', 'wit', 'woe', 'wok', 'won', 'woo', 'wow',
  'yak', 'yam', 'yap', 'yaw', 'yea', 'yes', 'yet', 'yew', 'yin', 'you', 'yow',
  'zap', 'zed', 'zen', 'zig', 'zoo',
  'шт', 'штука', 'комплект', 'набор', 'упаковка', 'размер', 'цвет', 'тип', 'модель', 'арт',
  'pc', 'pcs', 'set', 'kit', 'pack', 'size', 'color', 'type', 'model', 'item', 'new', '1', '2', '3', '4', '5',
  '10', '20', '30', '50', '100', '200', '500', '1000',
  'fbo', 'fbs', 'ozon', 'ро', '₽', 'руб', 'rub',
])

const transliterateRu = (word) => {
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y',
    'к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f',
    'х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  }
  return word.split('').map(c => map[c] || c).join('')
}

const RUSSIAN_SUFFIX_MEANINGS = [
  { suffix: 'ный', zh: '的', en: '' },
  { suffix: 'ная', zh: '的', en: '' },
  { suffix: 'ное', zh: '的', en: '' },
  { suffix: 'ные', zh: '的', en: '' },
  { suffix: 'ный', zh: '的', en: '' },
  { suffix: 'тельный', zh: '器', en: '' },
  { suffix: 'тельная', zh: '器', en: '' },
  { suffix: 'тельное', zh: '器', en: '' },
  { suffix: 'ость', zh: '性', en: '' },
  { suffix: 'ация', zh: '化', en: '' },
  { suffix: 'изация', zh: '化', en: '' },
  { suffix: 'ение', zh: '', en: '' },
  { suffix: 'ание', zh: '', en: '' },
  { suffix: 'ция', zh: '', en: '' },
  { suffix: 'ика', zh: '', en: '' },
  { suffix: 'очка', zh: '小', en: '' },
  { suffix: 'ечка', zh: '小', en: '' },
  { suffix: 'ушка', zh: '小', en: '' },
  { suffix: 'юшка', zh: '小', en: '' },
  { suffix: 'онок', zh: '小', en: '' },
  { suffix: 'еньк', zh: '小', en: '' },
  { suffix: 'ова', zh: '', en: '' },
  { suffix: 'ево', zh: '', en: '' },
  { suffix: 'иво', zh: '', en: '' },
  { suffix: 'ство', zh: '', en: '' },
  { suffix: 'ство', zh: '', en: '' },
]

const RUSSIAN_PREFIX_MEANINGS = [
  { prefix: 'авто', zh: '自动', en: 'Auto' },
  { prefix: 'анти', zh: '抗/防', en: 'Anti' },
  { prefix: 'микро', zh: '微', en: 'Micro' },
  { prefix: 'макро', zh: '宏', en: 'Macro' },
  { prefix: 'мини', zh: '迷你', en: 'Mini' },
  { prefix: 'макси', zh: '大', en: 'Maxi' },
  { prefix: 'мульти', zh: '多', en: 'Multi' },
  { prefix: 'поли', zh: '多', en: 'Poly' },
  { prefix: 'супер', zh: '超级', en: 'Super' },
  { prefix: 'ультра', zh: '超', en: 'Ultra' },
  { prefix: 'экстра', zh: '特', en: 'Extra' },
  { prefix: 'гипер', zh: '超', en: 'Hyper' },
  { prefix: 'интер', zh: '交互', en: 'Inter' },
  { prefix: 'нео', zh: '新', en: 'Neo' },
  { prefix: 'пре', zh: '前', en: 'Pre' },
  { prefix: 'пост', zh: '后', en: 'Post' },
  { prefix: 'про', zh: '专业', en: 'Pro' },
  { prefix: 'ре', zh: '再', en: 'Re' },
  { prefix: 'эко', zh: '环保', en: 'Eco' },
  { prefix: 'био', zh: '生物', en: 'Bio' },
  { prefix: 'нано', zh: '纳米', en: 'Nano' },
  { prefix: 'термо', zh: '热', en: 'Thermo' },
  { prefix: 'гидро', zh: '水', en: 'Hydro' },
  { prefix: 'аэро', zh: '气', en: 'Aero' },
  { prefix: 'электро', zh: '电', en: 'Electro' },
  { prefix: 'магнито', zh: '磁', en: 'Magneto' },
  { prefix: 'фото', zh: '光', en: 'Photo' },
  { prefix: 'вибро', zh: '振动', en: 'Vibro' },
  { prefix: 'звуко', zh: '声', en: 'Sound' },
  { prefix: 'тепло', zh: '热', en: 'Thermo' },
  { prefix: 'холод', zh: '冷', en: 'Cold' },
  { prefix: 'быстро', zh: '快', en: 'Fast' },
  { prefix: 'высоко', zh: '高', en: 'High' },
  { prefix: 'низко', zh: '低', en: 'Low' },
  { prefix: 'ново', zh: '新', en: 'New' },
  { prefix: 'противо', zh: '防/抗', en: 'Anti' },
  { prefix: 'водо', zh: '防水', en: 'Water' },
  { prefix: 'ветро', zh: '防风', en: 'Wind' },
  { prefix: 'огне', zh: '防火', en: 'Fire' },
  { prefix: 'пыл', zh: '防尘', en: 'Dust' },
  { prefix: 'умный', zh: '智能', en: 'Smart' },
  { prefix: 'умн', zh: '智能', en: 'Smart' },
]

const FEATURE_TRANSLATIONS = {
  'профессиональный': { en: 'Professional', zh: '专业级' },
  'проф': { en: 'Pro', zh: '专业级' },
  'pro': { en: 'Pro', zh: '专业级' },
  'портативный': { en: 'Portable', zh: '便携式' },
  'мини': { en: 'Mini', zh: '迷你' },
  'compact': { en: 'Compact', zh: '紧凑型' },
  'умный': { en: 'Smart', zh: '智能' },
  'smart': { en: 'Smart', zh: '智能' },
  'интеллект': { en: 'Intelligent', zh: '智能' },
  'складной': { en: 'Foldable', zh: '可折叠' },
  'склад': { en: 'Foldable', zh: '可折叠' },
  'fold': { en: 'Foldable', zh: '可折叠' },
  'мощный': { en: 'Powerful', zh: '大功率' },
  'мощн': { en: 'Powerful', zh: '大功率' },
  'powerful': { en: 'Powerful', zh: '大功率' },
  'тихий': { en: 'Quiet', zh: '静音' },
  'бесшумный': { en: 'Silent', zh: '静音' },
  'quiet': { en: 'Quiet', zh: '静音' },
  'быстрый': { en: 'Fast', zh: '快速' },
  'fast': { en: 'Fast', zh: '快速' },
  'quick': { en: 'Quick', zh: '快速' },
  'керамик': { en: 'Ceramic', zh: '陶瓷' },
  'ceramic': { en: 'Ceramic', zh: '陶瓷' },
  'керамический': { en: 'Ceramic', zh: '陶瓷' },
  'ионизация': { en: 'Ionization', zh: '离子' },
  'ион': { en: 'Ion', zh: '离子' },
  'ionic': { en: 'Ionic', zh: '离子' },
  'инвертор': { en: 'Inverter', zh: '变频' },
  'inverter': { en: 'Inverter', zh: '变频' },
  'защита': { en: 'Protection', zh: '防护' },
  'protection': { en: 'Protection', zh: '防护' },
  'safety': { en: 'Safety', zh: '安全' },
  'премиум': { en: 'Premium', zh: '高端' },
  'premium': { en: 'Premium', zh: '高端' },
  'люкс': { en: 'Luxury', zh: '奢华' },
  'lux': { en: 'Luxury', zh: '奢华' },
  'беспроводной': { en: 'Wireless', zh: '无线' },
  'wireless': { en: 'Wireless', zh: '无线' },
  'cordless': { en: 'Cordless', zh: '无绳' },
  'водонепроницаемый': { en: 'Waterproof', zh: '防水' },
  'waterproof': { en: 'Waterproof', zh: '防水' },
  'влагозащит': { en: 'Water-resistant', zh: '防潮' },
  'многофункциональный': { en: 'Multifunction', zh: '多功能' },
  'multifunction': { en: 'Multifunction', zh: '多功能' },
  'led': { en: 'LED', zh: 'LED' },
  'подсветк': { en: 'Backlight', zh: '背光' },
  'дисплей': { en: 'Display', zh: '显示屏' },
  'display': { en: 'Display', zh: '显示屏' },
  'автоматический': { en: 'Automatic', zh: '自动' },
  'авто': { en: 'Auto', zh: '自动' },
  'auto': { en: 'Auto', zh: '自动' },
  'регулировка': { en: 'Adjustment', zh: '可调节' },
  'регулируемый': { en: 'Adjustable', zh: '可调节' },
  'adjustable': { en: 'Adjustable', zh: '可调节' },
  'поворотный': { en: 'Rotatable', zh: '旋转' },
  'вращающийся': { en: 'Rotating', zh: '旋转' },
  'rotating': { en: 'Rotating', zh: '旋转' },
  'магнитный': { en: 'Magnetic', zh: '磁吸' },
  'magnetic': { en: 'Magnetic', zh: '磁吸' },
  'магнит': { en: 'Magnet', zh: '磁吸' },
  'силиконовый': { en: 'Silicone', zh: '硅胶' },
  'silicone': { en: 'Silicone', zh: '硅胶' },
  'силикон': { en: 'Silicone', zh: '硅胶' },
  'нержавеющий': { en: 'Stainless', zh: '不锈钢' },
  'stainless': { en: 'Stainless', zh: '不锈钢' },
  'металл': { en: 'Metal', zh: '金属' },
  'metal': { en: 'Metal', zh: '金属' },
  'пластик': { en: 'Plastic', zh: '塑料' },
  'plastic': { en: 'Plastic', zh: '塑料' },
  'деревянный': { en: 'Wooden', zh: '木质' },
  'wood': { en: 'Wood', zh: '木质' },
  'стекло': { en: 'Glass', zh: '玻璃' },
  'glass': { en: 'Glass', zh: '玻璃' },
  'ткань': { en: 'Fabric', zh: '织物' },
  'fabric': { en: 'Fabric', zh: '织物' },
  'хлопок': { en: 'Cotton', zh: '棉质' },
  'cotton': { en: 'Cotton', zh: '棉质' },
  'перезаряжаемый': { en: 'Rechargeable', zh: '可充电' },
  'rechargeable': { en: 'Rechargeable', zh: '可充电' },
  'аккумулятор': { en: 'Battery', zh: '电池' },
  'battery': { en: 'Battery', zh: '电池' },
  'usb': { en: 'USB', zh: 'USB充电' },
  'type-c': { en: 'Type-C', zh: 'Type-C' },
  'сенсорный': { en: 'Touch', zh: '触控' },
  'touch': { en: 'Touch', zh: '触控' },
  'кнопка': { en: 'Button', zh: '按键' },
  'button': { en: 'Button', zh: '按键' },
  'пульт': { en: 'Remote', zh: '遥控' },
  'remote': { en: 'Remote', zh: '遥控' },
  'таймер': { en: 'Timer', zh: '定时' },
  'timer': { en: 'Timer', zh: '定时' },
  'термостат': { en: 'Thermostat', zh: '恒温' },
  'thermostat': { en: 'Thermostat', zh: '恒温' },
  'термо': { en: 'Thermo', zh: '温控' },
  'eco': { en: 'Eco', zh: '环保' },
  'эко': { en: 'Eco', zh: '环保' },
  'детский': { en: "Kids'", zh: '儿童' },
  'дети': { en: "Kids'", zh: '儿童' },
  'kids': { en: "Kids'", zh: '儿童' },
  'мужской': { en: "Men's", zh: '男士' },
  'женский': { en: "Women's", zh: '女士' },
  'унисекс': { en: 'Unisex', zh: '中性' },
  'unisex': { en: 'Unisex', zh: '中性' },
  'подарок': { en: 'Gift', zh: '礼品' },
  'gift': { en: 'Gift', zh: '礼品' },
  'подарочный': { en: 'Gift', zh: '礼品装' },
  'оригинальный': { en: 'Original', zh: '原创' },
  'original': { en: 'Original', zh: '原创' },
  'классический': { en: 'Classic', zh: '经典' },
  'classic': { en: 'Classic', zh: '经典' },
  'современный': { en: 'Modern', zh: '现代' },
  'modern': { en: 'Modern', zh: '现代' },
  'дизайн': { en: 'Design', zh: '设计感' },
  'design': { en: 'Design', zh: '设计感' },
  'стильный': { en: 'Stylish', zh: '时尚' },
  'стиль': { en: 'Style', zh: '风格' },
  'style': { en: 'Style', zh: '风格' },
  'декоративный': { en: 'Decorative', zh: '装饰' },
  'decor': { en: 'Decor', zh: '装饰' },
  'decorative': { en: 'Decorative', zh: '装饰' },
  'настенный': { en: 'Wall-mounted', zh: '壁挂' },
  'wall': { en: 'Wall', zh: '壁挂' },
  'напольный': { en: 'Floor', zh: '落地' },
  'floor': { en: 'Floor', zh: '落地' },
  'настольный': { en: 'Desktop', zh: '桌面' },
  'desktop': { en: 'Desktop', zh: '桌面' },
  'portable': { en: 'Portable', zh: '便携' },
  'travel': { en: 'Travel', zh: '旅行' },
  'походный': { en: 'Travel', zh: '旅行' },
  'уличный': { en: 'Outdoor', zh: '户外' },
  'outdoor': { en: 'Outdoor', zh: '户外' },
  'домашний': { en: 'Home', zh: '家用' },
  'home': { en: 'Home', zh: '家用' },
  'бытовой': { en: 'Household', zh: '家用' },
  'household': { en: 'Household', zh: '家用' },
  'промышленный': { en: 'Industrial', zh: '工业级' },
  'industrial': { en: 'Industrial', zh: '工业级' },
  'медицинский': { en: 'Medical', zh: '医疗级' },
  'medical': { en: 'Medical', zh: '医疗级' },
  'китай': { en: 'China', zh: '中国制造' },
  'china': { en: 'China', zh: '中国制造' },
  'россия': { en: 'Russia', zh: '俄罗斯' },
  'russia': { en: 'Russia', zh: '俄罗斯' },
  'германия': { en: 'Germany', zh: '德国' },
  'germany': { en: 'Germany', zh: '德国' },
  'япония': { en: 'Japan', zh: '日本' },
  'japan': { en: 'Japan', zh: '日本' },
  'корея': { en: 'Korea', zh: '韩国' },
  'korea': { en: 'Korea', zh: '韩国' },
  'свет': { en: 'Light', zh: '照明' },
  'light': { en: 'Light', zh: '照明' },
  'лампа': { en: 'Lamp', zh: '灯具' },
  'lamp': { en: 'Lamp', zh: '灯具' },
  'ночь': { en: 'Night', zh: '夜间' },
  'night': { en: 'Night', zh: '夜间' },
  'теплый': { en: 'Warm', zh: '暖色' },
  'warm': { en: 'Warm', zh: '暖色' },
  'холодный': { en: 'Cold', zh: '冷色' },
  'cold': { en: 'Cold', zh: '冷色' },
  'rgb': { en: 'RGB', zh: 'RGB彩光' },
  'звук': { en: 'Sound', zh: '音效' },
  'sound': { en: 'Sound', zh: '音效' },
  'bluetooth': { en: 'Bluetooth', zh: '蓝牙' },
  'блютуз': { en: 'Bluetooth', zh: '蓝牙' },
  'wi-fi': { en: 'Wi-Fi', zh: 'Wi-Fi' },
  'wifi': { en: 'Wi-Fi', zh: 'Wi-Fi' },
  'вентилятор': { en: 'Fan', zh: '风扇' },
  'fan': { en: 'Fan', zh: '风扇' },
  'обогреватель': { en: 'Heater', zh: '加热器' },
  'heater': { en: 'Heater', zh: '加热器' },
  'увлажнитель': { en: 'Humidifier', zh: '加湿器' },
  'humidifier': { en: 'Humidifier', zh: '加湿器' },
  'очиститель': { en: 'Purifier', zh: '净化器' },
  'purifier': { en: 'Purifier', zh: '净化器' },
  'фильтр': { en: 'Filter', zh: '过滤器' },
  'filter': { en: 'Filter', zh: '过滤器' },
  'зарядный': { en: 'Charging', zh: '充电' },
  'charger': { en: 'Charger', zh: '充电器' },
  'зарядка': { en: 'Charger', zh: '充电器' },
  'держатель': { en: 'Holder', zh: '支架' },
  'holder': { en: 'Holder', zh: '支架' },
  'mount': { en: 'Mount', zh: '支架' },
  'крепление': { en: 'Mount', zh: '固定' },
  'органайзер': { en: 'Organizer', zh: '收纳' },
  'organizer': { en: 'Organizer', zh: '收纳' },
  'хранение': { en: 'Storage', zh: '储物' },
  'storage': { en: 'Storage', zh: '储物' },
  'коврик': { en: 'Mat', zh: '垫子' },
  'mat': { en: 'Mat', zh: '垫子' },
  'чехол': { en: 'Case', zh: '保护套' },
  'case': { en: 'Case', zh: '外壳/套' },
  'сумка': { en: 'Bag', zh: '包' },
  'bag': { en: 'Bag', zh: '包' },
  'рюкзак': { en: 'Backpack', zh: '背包' },
  'backpack': { en: 'Backpack', zh: '背包' },
  'зеркало': { en: 'Mirror', zh: '镜子' },
  'mirror': { en: 'Mirror', zh: '镜子' },
  'часы': { en: 'Clock/Watch', zh: '钟表' },
  'clock': { en: 'Clock', zh: '时钟' },
  'watch': { en: 'Watch', zh: '手表' },
  'весы': { en: 'Scale', zh: '秤' },
  'scale': { en: 'Scale', zh: '秤' },
  'массаж': { en: 'Massage', zh: '按摩' },
  'massage': { en: 'Massage', zh: '按摩' },
  'массажер': { en: 'Massager', zh: '按摩器' },
  'massager': { en: 'Massager', zh: '按摩器' },
  'фен': { en: 'Hair Dryer', zh: '吹风机' },
  'волос': { en: 'Hair', zh: '美发' },
  'стайлер': { en: 'Styler', zh: '造型器' },
  'мультистайлер': { en: 'Multi-styler', zh: '多功能造型器' },
  'насадк': { en: 'Attachment', zh: '配件/喷嘴' },
  'укладк': { en: 'Styling', zh: '造型' },
  'вращен': { en: 'Rotation', zh: '旋转' },
  'выпрямител': { en: 'Straightener', zh: '直发器' },
  'воздуходувк': { en: 'Blower', zh: '吹风器' },
  'альтернатив': { en: 'Alternative', zh: '替代品' },
  'аналог': { en: 'Analog/Alternative', zh: '平替' },
  'кейс': { en: 'Case', zh: '收纳盒' },
  'экран': { en: 'Screen', zh: '显示屏' },
  'компактн': { en: 'Compact', zh: '紧凑便携' },
  'женск': { en: "Women's", zh: '女士' },
  'розов': { en: 'Pink', zh: '粉色' },
  'зелен': { en: 'Green', zh: '绿色' },
  'щетк': { en: 'Brush', zh: '梳/刷' },
  'утюг': { en: 'Iron', zh: '熨斗' },
  'пылесос': { en: 'Vacuum Cleaner', zh: '吸尘器' },
  'холодильник': { en: 'Refrigerator', zh: '冰箱' },
  'стиральн': { en: 'Washing', zh: '洗衣机' },
  'микроволнов': { en: 'Microwave', zh: '微波炉' },
  'кофеварк': { en: 'Coffee Maker', zh: '咖啡机' },
  'кофемашина': { en: 'Coffee Machine', zh: '咖啡机' },
  'блендер': { en: 'Blender', zh: '搅拌机' },
  'миксер': { en: 'Mixer', zh: '搅拌器' },
  'тостер': { en: 'Toaster', zh: '烤面包机' },
  'чайник': { en: 'Kettle', zh: '水壶' },
  'плит': { en: 'Stove', zh: '灶具' },
  'духов': { en: 'Oven', zh: '烤箱' },
  'вытяжк': { en: 'Hood', zh: '油烟机' },
  'посудомо': { en: 'Dishwasher', zh: '洗碗机' },
  'кондиционер': { en: 'Air Conditioner', zh: '空调' },
  'обогрев': { en: 'Heater', zh: '取暖器' },
  'теплов': { en: 'Thermal', zh: '热力' },
  'насос': { en: 'Pump', zh: '泵' },
  'генератор': { en: 'Generator', zh: '发电机' },
  'трансформатор': { en: 'Transformer', zh: '变压器' },
  'робот': { en: 'Robot', zh: '机器人' },
  'robot': { en: 'Robot', zh: '机器人' },
  'электрический': { en: 'Electric', zh: '电动' },
  'electric': { en: 'Electric', zh: '电动' },
  'электронный': { en: 'Electronic', zh: '电子' },
  'electronic': { en: 'Electronic', zh: '电子' },
  'механический': { en: 'Mechanical', zh: '机械' },
  'mechanical': { en: 'Mechanical', zh: '机械' },
  'ручной': { en: 'Manual', zh: '手动' },
  'manual': { en: 'Manual', zh: '手动' },
  'нож': { en: 'Knife', zh: '刀' },
  'knife': { en: 'Knife', zh: '刀' },
  'ножницы': { en: 'Scissors', zh: '剪刀' },
  'инструмент': { en: 'Tool', zh: '工具' },
  'tool': { en: 'Tool', zh: '工具' },
  'набор': { en: 'Set', zh: '套装' },
  'set': { en: 'Set', zh: '套装' },
  'комплект': { en: 'Kit', zh: '套装' },
  'kit': { en: 'Kit', zh: '套装' },
  'упаковка': { en: 'Pack', zh: '包装' },
  'pack': { en: 'Pack', zh: '包装' },
  'блок': { en: 'Block', zh: '模块' },
  'модуль': { en: 'Module', zh: '模块' },
  'module': { en: 'Module', zh: '模块' },
  'система': { en: 'System', zh: '系统' },
  'system': { en: 'System', zh: '系统' },
  'контроллер': { en: 'Controller', zh: '控制器' },
  'controller': { en: 'Controller', zh: '控制器' },
  'датчик': { en: 'Sensor', zh: '传感器' },
  'sensor': { en: 'Sensor', zh: '传感器' },
  'камера': { en: 'Camera', zh: '摄像头' },
  'camera': { en: 'Camera', zh: '摄像头' },
  'видео': { en: 'Video', zh: '视频' },
  'video': { en: 'Video', zh: '视频' },
  'аудио': { en: 'Audio', zh: '音频' },
  'audio': { en: 'Audio', zh: '音频' },
  'микрофон': { en: 'Microphone', zh: '麦克风' },
  'микрофибр': { en: 'Microfiber', zh: '超细纤维' },
  'наушник': { en: 'Headphone', zh: '耳机' },
  'колонк': { en: 'Speaker', zh: '音箱' },
  'speaker': { en: 'Speaker', zh: '音箱' },
  'принтер': { en: 'Printer', zh: '打印机' },
  'сканер': { en: 'Scanner', zh: '扫描仪' },
  'монитор': { en: 'Monitor', zh: '显示器' },
  'клавиатур': { en: 'Keyboard', zh: '键盘' },
  'мышь': { en: 'Mouse', zh: '鼠标' },
  'mouse': { en: 'Mouse', zh: '鼠标' },
  'ноутбук': { en: 'Laptop', zh: '笔记本' },
  'laptop': { en: 'Laptop', zh: '笔记本' },
  'планшет': { en: 'Tablet', zh: '平板' },
  'tablet': { en: 'Tablet', zh: '平板' },
  'телефон': { en: 'Phone', zh: '电话' },
  'phone': { en: 'Phone', zh: '电话' },
  'смартфон': { en: 'Smartphone', zh: '智能手机' },
  'smartphone': { en: 'Smartphone', zh: '智能手机' },
  'наручный': { en: 'Wrist', zh: '腕戴' },
  'браслет': { en: 'Bracelet', zh: '手环/手镯' },
  'кольцо': { en: 'Ring', zh: '戒指' },
  'цепочка': { en: 'Chain', zh: '链条' },
  'ожерелье': { en: 'Necklace', zh: '项链' },
  'серьги': { en: 'Earrings', zh: '耳环' },
  'кулон': { en: 'Pendant', zh: '吊坠' },
  'подвеска': { en: 'Pendant', zh: '挂件' },
  'шарф': { en: 'Scarf', zh: '围巾' },
  'шапка': { en: 'Hat', zh: '帽子' },
  'шляпа': { en: 'Hat', zh: '礼帽' },
  'носки': { en: 'Socks', zh: '袜子' },
  'обувь': { en: 'Shoes', zh: '鞋' },
  'ботинки': { en: 'Boots', zh: '靴子' },
  'сапоги': { en: 'Boots', zh: '长靴' },
  'куртк': { en: 'Jacket', zh: '夹克' },
  'пальто': { en: 'Coat', zh: '大衣' },
  'пуховик': { en: 'Puffer', zh: '羽绒服' },
  'свитер': { en: 'Sweater', zh: '毛衣' },
  'рубашк': { en: 'Shirt', zh: '衬衫' },
  'футболк': { en: 'T-shirt', zh: 'T恤' },
  'джинсы': { en: 'Jeans', zh: '牛仔裤' },
  'брюки': { en: 'Trousers', zh: '裤子' },
  'платье': { en: 'Dress', zh: '连衣裙' },
  'юбка': { en: 'Skirt', zh: '裙子' },
  'купальник': { en: 'Swimsuit', zh: '泳衣' },
  'костюм': { en: 'Suit', zh: '套装' },
  'suit': { en: 'Suit', zh: '套装' },
  'нижнее': { en: 'Underwear', zh: '内衣' },
  'белье': { en: 'Linen', zh: '内衣' },
  'одежда': { en: 'Clothing', zh: '服装' },
  'clothing': { en: 'Clothing', zh: '服装' },
  'косметик': { en: 'Cosmetics', zh: '化妆品' },
  'крем': { en: 'Cream', zh: '面霜' },
  'cream': { en: 'Cream', zh: '面霜' },
  'шампунь': { en: 'Shampoo', zh: '洗发水' },
  'гель': { en: 'Gel', zh: '凝胶' },
  'gel': { en: 'Gel', zh: '凝胶' },
  'лосьон': { en: 'Lotion', zh: '乳液' },
  'лак': { en: 'Varnish', zh: '漆/指甲油' },
  'помада': { en: 'Lipstick', zh: '口红' },
  'тушь': { en: 'Mascara', zh: '睫毛膏' },
  'пудра': { en: 'Powder', zh: '粉饼' },
  'духи': { en: 'Perfume', zh: '香水' },
  'парфюм': { en: 'Perfume', zh: '香水' },
  'perfume': { en: 'Perfume', zh: '香水' },
  'дезодорант': { en: 'Deodorant', zh: '止汗剂' },
  'зубной': { en: 'Dental', zh: '牙齿' },
  'щетка': { en: 'Brush', zh: '刷子' },
  'brush': { en: 'Brush', zh: '刷子' },
  'расческа': { en: 'Comb', zh: '梳子' },
  'полотенце': { en: 'Towel', zh: '毛巾' },
  'towel': { en: 'Towel', zh: '毛巾' },
  'постельн': { en: 'Bedding', zh: '床品' },
  'одеяло': { en: 'Blanket', zh: '被子' },
  'подушк': { en: 'Pillow', zh: '枕头' },
  'матрас': { en: 'Mattress', zh: '床垫' },
  'покрывало': { en: 'Bedspread', zh: '床罩' },
  'шторы': { en: 'Curtains', zh: '窗帘' },
  'ковер': { en: 'Carpet', zh: '地毯' },
  'carpet': { en: 'Carpet', zh: '地毯' },
  'ваза': { en: 'Vase', zh: '花瓶' },
  'картин': { en: 'Picture', zh: '画' },
  'рамка': { en: 'Frame', zh: '相框' },
  'свеча': { en: 'Candle', zh: '蜡烛' },
  'аромат': { en: 'Aroma', zh: '香薰' },
  'корм': { en: 'Feed', zh: '饲料' },
  'витамин': { en: 'Vitamin', zh: '维生素' },
  'добавк': { en: 'Supplement', zh: '补充剂' },
  'протеин': { en: 'Protein', zh: '蛋白粉' },
  'спальн': { en: 'Bedroom', zh: '卧室' },
  'ванная': { en: 'Bathroom', zh: '浴室' },
  'кухня': { en: 'Kitchen', zh: '厨房' },
  'kitchen': { en: 'Kitchen', zh: '厨房' },
  'гостин': { en: 'Living Room', zh: '客厅' },
  'детская': { en: "Kids' Room", zh: '儿童房' },
  'офис': { en: 'Office', zh: '办公' },
  'office': { en: 'Office', zh: '办公' },
  'гараж': { en: 'Garage', zh: '车库' },
  'садовый': { en: 'Garden', zh: '花园' },
  'garden': { en: 'Garden', zh: '花园' },
  'дверь': { en: 'Door', zh: '门' },
  'door': { en: 'Door', zh: '门' },
  'окно': { en: 'Window', zh: '窗户' },
  'window': { en: 'Window', zh: '窗户' },
  'стен': { en: 'Wall', zh: '墙壁' },
  'пол': { en: 'Floor', zh: '地板' },
  'потолок': { en: 'Ceiling', zh: '天花板' },
  'лестниц': { en: 'Stairs', zh: '楼梯' },
  'шкаф': { en: 'Cabinet', zh: '柜子' },
  'cabinet': { en: 'Cabinet', zh: '柜子' },
  'полка': { en: 'Shelf', zh: '架子' },
  'shelf': { en: 'Shelf', zh: '架子' },
  'ящик': { en: 'Drawer', zh: '抽屉' },
  'стол': { en: 'Table', zh: '桌子' },
  'table': { en: 'Table', zh: '桌子' },
  'стул': { en: 'Chair', zh: '椅子' },
  'chair': { en: 'Chair', zh: '椅子' },
  'кресло': { en: 'Armchair', zh: '扶手椅' },
  'диван': { en: 'Sofa', zh: '沙发' },
  'кровать': { en: 'Bed', zh: '床' },
  'bed': { en: 'Bed', zh: '床' },
  'колесо': { en: 'Wheel', zh: '轮子' },
  'wheel': { en: 'Wheel', zh: '轮子' },
  'двигатель': { en: 'Engine', zh: '发动机' },
  'engine': { en: 'Engine', zh: '发动机' },
  'мотор': { en: 'Motor', zh: '马达' },
  'motor': { en: 'Motor', zh: '马达' },
  'редуктор': { en: 'Reducer', zh: '减速器' },
  'клапан': { en: 'Valve', zh: '阀门' },
  'valve': { en: 'Valve', zh: '阀门' },
  'трубк': { en: 'Tube', zh: '管' },
  'труб': { en: 'Pipe', zh: '管道' },
  'pipe': { en: 'Pipe', zh: '管道' },
  'шланг': { en: 'Hose', zh: '软管' },
  'hose': { en: 'Hose', zh: '软管' },
  'кабель': { en: 'Cable', zh: '电缆' },
  'cable': { en: 'Cable', zh: '电缆' },
  'провод': { en: 'Wire', zh: '导线' },
  'wire': { en: 'Wire', zh: '导线' },
  'разъем': { en: 'Connector', zh: '接口' },
  'connector': { en: 'Connector', zh: '接口' },
  'адаптер': { en: 'Adapter', zh: '适配器' },
  'adapter': { en: 'Adapter', zh: '适配器' },
  'переходник': { en: 'Adapter', zh: '转接器' },
  'удлинитель': { en: 'Extension', zh: '延长线' },
  'extension': { en: 'Extension', zh: '延长线' },
  'стабилизатор': { en: 'Stabilizer', zh: '稳压器' },
  'реле': { en: 'Relay', zh: '继电器' },
  'предохранитель': { en: 'Fuse', zh: '保险丝' },
  'выключатель': { en: 'Switch', zh: '开关' },
  'switch': { en: 'Switch', zh: '开关' },
  'розетка': { en: 'Socket', zh: '插座' },
  'socket': { en: 'Socket', zh: '插座' },
  'вилка': { en: 'Plug', zh: '插头' },
  'plug': { en: 'Plug', zh: '插头' },
  'батарея': { en: 'Battery', zh: '电池' },
  'зарядное': { en: 'Charger', zh: '充电器' },
  'солнечный': { en: 'Solar', zh: '太阳能' },
  'solar': { en: 'Solar', zh: '太阳能' },
  'ветровой': { en: 'Wind', zh: '风力' },
  'гидро': { en: 'Hydro', zh: '水力' },
  'пневматический': { en: 'Pneumatic', zh: '气动' },
  'газовый': { en: 'Gas', zh: '燃气' },
  'gas': { en: 'Gas', zh: '燃气' },
  'жидкий': { en: 'Liquid', zh: '液体' },
  'liquid': { en: 'Liquid', zh: '液体' },
  'порошок': { en: 'Powder', zh: '粉末' },
  'powder': { en: 'Powder', zh: '粉末' },
  'спрей': { en: 'Spray', zh: '喷雾' },
  'spray': { en: 'Spray', zh: '喷雾' },
  'аэрозоль': { en: 'Aerosol', zh: '气雾剂' },
  'масло': { en: 'Oil', zh: '油' },
  'oil': { en: 'Oil', zh: '油' },
  'смазка': { en: 'Lubricant', zh: '润滑' },
  'краск': { en: 'Paint', zh: '油漆' },
  'paint': { en: 'Paint', zh: '油漆' },
  'грунтовк': { en: 'Primer', zh: '底漆' },
  'штукатурк': { en: 'Plaster', zh: '石膏' },
  'цемент': { en: 'Cement', zh: '水泥' },
  'бетон': { en: 'Concrete', zh: '混凝土' },
  'кирпич': { en: 'Brick', zh: '砖' },
  'черный': { en: 'Black', zh: '黑色' },
  'black': { en: 'Black', zh: '黑色' },
  'белый': { en: 'White', zh: '白色' },
  'white': { en: 'White', zh: '白色' },
  'красный': { en: 'Red', zh: '红色' },
  'red': { en: 'Red', zh: '红色' },
  'синий': { en: 'Blue', zh: '蓝色' },
  'blue': { en: 'Blue', zh: '蓝色' },
  'зеленый': { en: 'Green', zh: '绿色' },
  'green': { en: 'Green', zh: '绿色' },
  'желтый': { en: 'Yellow', zh: '黄色' },
  'yellow': { en: 'Yellow', zh: '黄色' },
  'розовый': { en: 'Pink', zh: '粉色' },
  'pink': { en: 'Pink', zh: '粉色' },
  'серый': { en: 'Gray', zh: '灰色' },
  'gray': { en: 'Gray', zh: '灰色' },
  'серебряный': { en: 'Silver', zh: '银色' },
  'silver': { en: 'Silver', zh: '银色' },
  'золотой': { en: 'Gold', zh: '金色' },
  'gold': { en: 'Gold', zh: '金色' },
  'прозрачный': { en: 'Transparent', zh: '透明' },
  'transparent': { en: 'Transparent', zh: '透明' },
  'матовый': { en: 'Matte', zh: '哑光' },
  'глянцевый': { en: 'Glossy', zh: '亮面' },
  'большой': { en: 'Large', zh: '大号' },
  'large': { en: 'Large', zh: '大号' },
  'маленький': { en: 'Small', zh: '小号' },
  'small': { en: 'Small', zh: '小号' },
  'средний': { en: 'Medium', zh: '中号' },
  'medium': { en: 'Medium', zh: '中号' },
  'длинный': { en: 'Long', zh: '长款' },
  'короткий': { en: 'Short', zh: '短款' },
  'широкий': { en: 'Wide', zh: '宽' },
  'узкий': { en: 'Narrow', zh: '窄' },
  'толстый': { en: 'Thick', zh: '厚' },
  'тонкий': { en: 'Thin', zh: '薄' },
  'высокий': { en: 'High', zh: '高' },
  'низкий': { en: 'Low', zh: '低' },
  'легкий': { en: 'Light', zh: '轻量' },
  'тяжелый': { en: 'Heavy', zh: '重型' },
  'прочный': { en: 'Durable', zh: '耐用' },
  'durable': { en: 'Durable', zh: '耐用' },
  'надежный': { en: 'Reliable', zh: '可靠' },
  'reliable': { en: 'Reliable', zh: '可靠' },
  'удобный': { en: 'Comfortable', zh: '舒适' },
  'comfortable': { en: 'Comfortable', zh: '舒适' },
  'практичный': { en: 'Practical', zh: '实用' },
  'элегантный': { en: 'Elegant', zh: '优雅' },
  'роскошный': { en: 'Luxurious', zh: '豪华' },
  'яркий': { en: 'Bright', zh: '鲜艳' },
  'bright': { en: 'Bright', zh: '鲜艳' },
  'темный': { en: 'Dark', zh: '深色' },
  'dark': { en: 'Dark', zh: '深色' },
  'мягкий': { en: 'Soft', zh: '柔软' },
  'soft': { en: 'Soft', zh: '柔软' },
  'жесткий': { en: 'Hard', zh: '硬' },
  'hard': { en: 'Hard', zh: '硬' },
  'гладкий': { en: 'Smooth', zh: '光滑' },
  'шероховатый': { en: 'Rough', zh: '粗糙' },
  'антискольз': { en: 'Anti-slip', zh: '防滑' },
  'антибактериальн': { en: 'Antibacterial', zh: '抗菌' },
  'гипоаллерген': { en: 'Hypoallergenic', zh: '低敏' },
  'ультрафиолет': { en: 'UV', zh: '紫外线' },
  'uv': { en: 'UV', zh: '紫外线' },
  'инфракрасный': { en: 'Infrared', zh: '红外' },
  'infrared': { en: 'Infrared', zh: '红外' },
  'лазер': { en: 'Laser', zh: '激光' },
  'laser': { en: 'Laser', zh: '激光' },
  'ультразвук': { en: 'Ultrasonic', zh: '超声波' },
  'вакуумный': { en: 'Vacuum', zh: '真空' },
  'vacuum': { en: 'Vacuum', zh: '真空' },
  'двойной': { en: 'Double', zh: '双层' },
  'double': { en: 'Double', zh: '双层' },
  'тройной': { en: 'Triple', zh: '三层' },
  'усиленный': { en: 'Reinforced', zh: '加固' },
  'съемный': { en: 'Removable', zh: '可拆卸' },
  'removable': { en: 'Removable', zh: '可拆卸' },
  'заменяемый': { en: 'Replaceable', zh: '可更换' },
  'универсальный': { en: 'Universal', zh: '通用' },
  'universal': { en: 'Universal', zh: '通用' },
  'мульти': { en: 'Multi', zh: '多' },
  'multi': { en: 'Multi', zh: '多' },
  'макси': { en: 'Maxi', zh: '加大' },
  'максимальный': { en: 'Maximum', zh: '最大' },
  'maximum': { en: 'Maximum', zh: '最大' },
  'оптимальный': { en: 'Optimal', zh: '最优' },
  'эффективный': { en: 'Efficient', zh: '高效' },
  'efficient': { en: 'Efficient', zh: '高效' },
  'экономичный': { en: 'Economical', zh: '经济' },
  'энергосберегающ': { en: 'Energy-saving', zh: '节能' },
  'бытов': { en: 'Household', zh: '日用' },
  'культурн': { en: 'Cultural', zh: '文化' },
  'специализированный': { en: 'Specialized', zh: '专用' },
  'эксклюзивный': { en: 'Exclusive', zh: '独家' },
  'лимитированный': { en: 'Limited', zh: '限量' },
  'limited': { en: 'Limited', zh: '限量' },
  'новинка': { en: 'New Arrival', zh: '新品' },
  'хит': { en: 'Hit', zh: '爆款' },
  'бестселлер': { en: 'Bestseller', zh: '畅销' },
  'bestseller': { en: 'Bestseller', zh: '畅销' },
  'топ': { en: 'Top', zh: '热卖' },
  'top': { en: 'Top', zh: '热卖' },
  'sale': { en: 'Sale', zh: '促销' },
  'скидк': { en: 'Discount', zh: '折扣' },
  'discount': { en: 'Discount', zh: '折扣' },
  'акция': { en: 'Promotion', zh: '活动' },
  'promotion': { en: 'Promotion', zh: '活动' },
  'выгодный': { en: 'Profitable', zh: '划算' },
  'дешевый': { en: 'Cheap', zh: '便宜' },
  'дорогой': { en: 'Expensive', zh: '昂贵' },
  'бесплатный': { en: 'Free', zh: '免费' },
  'free': { en: 'Free', zh: '免费' },
  'гарантия': { en: 'Warranty', zh: '保修' },
  'warranty': { en: 'Warranty', zh: '保修' },
  'сертификат': { en: 'Certificate', zh: '证书' },
  'certificate': { en: 'Certificate', zh: '证书' },
  'стандарт': { en: 'Standard', zh: '标准' },
  'standard': { en: 'Standard', zh: '标准' },
  'качество': { en: 'Quality', zh: '品质' },
  'quality': { en: 'Quality', zh: '品质' },
  'контроль': { en: 'Control', zh: '控制' },
  'control': { en: 'Control', zh: '控制' },
  'тест': { en: 'Test', zh: '测试' },
  'test': { en: 'Test', zh: '测试' },
  'проверенный': { en: 'Verified', zh: '验证' },
  'verified': { en: 'Verified', zh: '验证' },
  'одобренный': { en: 'Approved', zh: '认证' },
  'approved': { en: 'Approved', zh: '认证' },
  'рекомендуемый': { en: 'Recommended', zh: '推荐' },
  'recommended': { en: 'Recommended', zh: '推荐' },
  'популярный': { en: 'Popular', zh: '热门' },
  'popular': { en: 'Popular', zh: '热门' },
  'востребованный': { en: 'In-demand', zh: '需求高' },
  'востребован': { en: 'In-demand', zh: '需求高' },
  'распродажа': { en: 'Clearance', zh: '清仓' },
  'clearance': { en: 'Clearance', zh: '清仓' },
  'выбор': { en: 'Choice', zh: '精选' },
  'choice': { en: 'Choice', zh: '精选' },
  'подписк': { en: 'Subscription', zh: '订阅' },
  'доставка': { en: 'Delivery', zh: '配送' },
  'delivery': { en: 'Delivery', zh: '配送' },
  'отзыв': { en: 'Review', zh: '评价' },
  'review': { en: 'Review', zh: '评价' },
  'рейтинг': { en: 'Rating', zh: '评分' },
  'rating': { en: 'Rating', zh: '评分' },
  'звезд': { en: 'Star', zh: '星级' },
  'star': { en: 'Star', zh: '星级' },
  'номер': { en: 'Number', zh: '编号' },
  'партия': { en: 'Batch', zh: '批次' },
  'серия': { en: 'Series', zh: '系列' },
  'series': { en: 'Series', zh: '系列' },
  'версия': { en: 'Version', zh: '版本' },
  'version': { en: 'Version', zh: '版本' },
  'поколение': { en: 'Generation', zh: '代' },
  'generation': { en: 'Generation', zh: '代' },
  'upgrade': { en: 'Upgrade', zh: '升级' },
  'апгрейд': { en: 'Upgrade', zh: '升级' },
  'плюс': { en: 'Plus', zh: '增强版' },
  'plus': { en: 'Plus', zh: '增强版' },
  'макс': { en: 'Max', zh: '顶配' },
  'max': { en: 'Max', zh: '顶配' },
  'ультра': { en: 'Ultra', zh: '超' },
  'ultra': { en: 'Ultra', zh: '超' },
  'супер': { en: 'Super', zh: '超级' },
  'super': { en: 'Super', zh: '超级' },
  'экстра': { en: 'Extra', zh: '特级' },
  'extra': { en: 'Extra', zh: '特级' },
  'хай': { en: 'High', zh: '高' },
  'hi': { en: 'Hi', zh: '高' },
  'элит': { en: 'Elite', zh: '精英' },
  'elite': { en: 'Elite', zh: '精英' },
  'прайм': { en: 'Prime', zh: '尊享' },
  'prime': { en: 'Prime', zh: '尊享' },
  'био': { en: 'Bio', zh: '生物' },
  'bio': { en: 'Bio', zh: '生物' },
  'органик': { en: 'Organic', zh: '有机' },
  'organic': { en: 'Organic', zh: '有机' },
  'натуральн': { en: 'Natural', zh: '天然' },
  'natural': { en: 'Natural', zh: '天然' },
  'искусствен': { en: 'Artificial', zh: '人造' },
  'синтетическ': { en: 'Synthetic', zh: '合成' },
  'комбинирован': { en: 'Combined', zh: '组合' },
  'цельн': { en: 'Solid', zh: '整体' },
  'сборный': { en: 'Prefabricated', zh: '组装' },
  'литой': { en: 'Cast', zh: '铸造' },
  'штампован': { en: 'Stamped', zh: '冲压' },
  'кованый': { en: 'Forged', zh: '锻造' },
  'плетеный': { en: 'Woven', zh: '编织' },
  'вязаный': { en: 'Knitted', zh: '针织' },
  'вышивк': { en: 'Embroidery', zh: '刺绣' },
  'принт': { en: 'Print', zh: '印花' },
  'print': { en: 'Print', zh: '印花' },
  'узор': { en: 'Pattern', zh: '图案' },
  'pattern': { en: 'Pattern', zh: '图案' },
  'логотип': { en: 'Logo', zh: '标志' },
  'logo': { en: 'Logo', zh: '标志' },
  'брендовый': { en: 'Branded', zh: '品牌' },
  'бренд': { en: 'Brand', zh: '品牌' },
  'brand': { en: 'Brand', zh: '品牌' },
  'фирменный': { en: 'Original Brand', zh: '正品' },
  'лицензия': { en: 'Licensed', zh: '授权' },
  'патент': { en: 'Patent', zh: '专利' },
  'patent': { en: 'Patent', zh: '专利' },
  'технология': { en: 'Technology', zh: '技术' },
  'technology': { en: 'Technology', zh: '技术' },
  'инноваци': { en: 'Innovation', zh: '创新' },
  'innovation': { en: 'Innovation', zh: '创新' },
  'разработк': { en: 'Development', zh: '开发' },
  'производство': { en: 'Production', zh: '生产' },
  'production': { en: 'Production', zh: '生产' },
  'заводской': { en: 'Factory', zh: '工厂' },
  'factory': { en: 'Factory', zh: '工厂' },
  'ручная': { en: 'Handmade', zh: '手工' },
  'handmade': { en: 'Handmade', zh: '手工' },
  'импорт': { en: 'Import', zh: '进口' },
  'import': { en: 'Import', zh: '进口' },
  'экспорт': { en: 'Export', zh: '出口' },
  'export': { en: 'Export', zh: '出口' },
  'локальный': { en: 'Local', zh: '本地' },
  'local': { en: 'Local', zh: '本地' },
  'международный': { en: 'International', zh: '国际' },
  'international': { en: 'International', zh: '国际' },
  'глобальный': { en: 'Global', zh: '全球' },
  'global': { en: 'Global', zh: '全球' },
  'сетевой': { en: 'Network', zh: '网络' },
  'network': { en: 'Network', zh: '网络' },
  'цифровой': { en: 'Digital', zh: '数字' },
  'digital': { en: 'Digital', zh: '数字' },
  'аналоговый': { en: 'Analog', zh: '模拟' },
  'analog': { en: 'Analog', zh: '模拟' },
  'программный': { en: 'Software', zh: '软件' },
  'software': { en: 'Software', zh: '软件' },
  'аппаратный': { en: 'Hardware', zh: '硬件' },
  'hardware': { en: 'Hardware', zh: '硬件' },
  'прошивк': { en: 'Firmware', zh: '固件' },
  'firmware': { en: 'Firmware', zh: '固件' },
  'обновлен': { en: 'Updated', zh: '更新' },
  'updated': { en: 'Updated', zh: '更新' },
  'совместимый': { en: 'Compatible', zh: '兼容' },
  'compatible': { en: 'Compatible', zh: '兼容' },
  'подключен': { en: 'Connected', zh: '连接' },
  'интегрированный': { en: 'Integrated', zh: '集成' },
  'integrated': { en: 'Integrated', zh: '集成' },
  'встроенный': { en: 'Built-in', zh: '内置' },
  'built-in': { en: 'Built-in', zh: '内置' },
  'внешний': { en: 'External', zh: '外置' },
  'external': { en: 'External', zh: '外置' },
  'внутренний': { en: 'Internal', zh: '内置' },
  'internal': { en: 'Internal', zh: '内置' },
  'отдельный': { en: 'Separate', zh: '独立' },
  'separate': { en: 'Separate', zh: '独立' },
  'портативн': { en: 'Portable', zh: '便携' },
  'стационарный': { en: 'Stationary', zh: '固定式' },
  'мобильный': { en: 'Mobile', zh: '移动' },
  'mobile': { en: 'Mobile', zh: '移动' },
  'переносной': { en: 'Portable', zh: '手提' },
  'накладной': { en: 'Surface-mounted', zh: '表面安装' },
  'врезной': { en: 'Flush-mounted', zh: '嵌入式' },
  'потолочный': { en: 'Ceiling', zh: '吸顶' },
  'угловой': { en: 'Corner', zh: '转角' },
  'прямой': { en: 'Straight', zh: '直' },
  'кривой': { en: 'Curved', zh: '弧形' },
  'круглый': { en: 'Round', zh: '圆形' },
  'квадратный': { en: 'Square', zh: '方形' },
  'прямоугольный': { en: 'Rectangular', zh: '矩形' },
  'овальный': { en: 'Oval', zh: '椭圆' },
  'треугольный': { en: 'Triangular', zh: '三角' },
  'плоский': { en: 'Flat', zh: '扁平' },
  'flat': { en: 'Flat', zh: '扁平' },
  'выпуклый': { en: 'Convex', zh: '凸' },
  'вогнутый': { en: 'Concave', zh: '凹' },
  'ребристый': { en: 'Ribbed', zh: '肋状' },
  'рифленый': { en: 'Knurled', zh: '滚花' },
  'текстурированный': { en: 'Textured', zh: '纹理' },
  'зеркальный': { en: 'Mirrored', zh: '镜面' },
  'хромированный': { en: 'Chrome', zh: '镀铬' },
  'chrome': { en: 'Chrome', zh: '镀铬' },
  'никелированный': { en: 'Nickel-plated', zh: '镀镍' },
  'оцинкованный': { en: 'Galvanized', zh: '镀锌' },
  'анодированный': { en: 'Anodized', zh: '阳极氧化' },
  'ламинированный': { en: 'Laminated', zh: '覆膜' },
  'лакированный': { en: 'Lacquered', zh: '上漆' },
  'полированный': { en: 'Polished', zh: '抛光' },
  'шлифованный': { en: 'Ground', zh: '磨削' },
  'порошковый': { en: 'Powder-coated', zh: '粉末涂层' },
  'резиновый': { en: 'Rubber', zh: '橡胶' },
  'rubber': { en: 'Rubber', zh: '橡胶' },
  'латунный': { en: 'Brass', zh: '黄铜' },
  'brass': { en: 'Brass', zh: '黄铜' },
  'медный': { en: 'Copper', zh: '铜' },
  'copper': { en: 'Copper', zh: '铜' },
  'алюминевый': { en: 'Aluminum', zh: '铝' },
  'aluminum': { en: 'Aluminum', zh: '铝' },
  'алюминиевый': { en: 'Aluminum', zh: '铝合金' },
  'чугунный': { en: 'Cast Iron', zh: '铸铁' },
  'титановый': { en: 'Titanium', zh: '钛' },
  'titanium': { en: 'Titanium', zh: '钛' },
  'карбоновый': { en: 'Carbon', zh: '碳纤维' },
  'carbon': { en: 'Carbon', zh: '碳纤维' },
  'нейлоновый': { en: 'Nylon', zh: '尼龙' },
  'nylon': { en: 'Nylon', zh: '尼龙' },
  'полиэстер': { en: 'Polyester', zh: '聚酯' },
  'polyester': { en: 'Polyester', zh: '聚酯' },
  'полиуретан': { en: 'Polyurethane', zh: '聚氨酯' },
  'акрил': { en: 'Acrylic', zh: '亚克力' },
  'acrylic': { en: 'Acrylic', zh: '亚克力' },
  'полипропилен': { en: 'Polypropylene', zh: '聚丙烯' },
  'полиэтилен': { en: 'Polyethylene', zh: '聚乙烯' },
  'пвх': { en: 'PVC', zh: 'PVC' },
  'pvc': { en: 'PVC', zh: 'PVC' },
  'абс': { en: 'ABS', zh: 'ABS' },
  'abs': { en: 'ABS', zh: 'ABS' },
  'мдф': { en: 'MDF', zh: 'MDF' },
  'mdf': { en: 'MDF', zh: 'MDF' },
  'дсп': { en: 'Chipboard', zh: '刨花板' },
  'фанер': { en: 'Plywood', zh: '胶合板' },
  'пробковый': { en: 'Cork', zh: '软木' },
  'бамбуковый': { en: 'Bamboo', zh: '竹' },
  'bamboo': { en: 'Bamboo', zh: '竹' },
  'льняной': { en: 'Linen', zh: '亚麻' },
  'linen': { en: 'Linen', zh: '亚麻' },
  'шелковый': { en: 'Silk', zh: '丝绸' },
  'silk': { en: 'Silk', zh: '丝绸' },
  'вельвет': { en: 'Velvet', zh: '丝绒' },
  'velvet': { en: 'Velvet', zh: '丝绒' },
  'замш': { en: 'Suede', zh: '麂皮' },
  'suede': { en: 'Suede', zh: '麂皮' },
  'кожаный': { en: 'Leather', zh: '真皮' },
  'leather': { en: 'Leather', zh: '真皮' },
  'кожзам': { en: 'Faux Leather', zh: '人造革' },
  'искусственн': { en: 'Artificial', zh: '人造' },
  'меховой': { en: 'Fur', zh: '毛皮' },
  'fur': { en: 'Fur', zh: '毛皮' },
  'пуховый': { en: 'Down', zh: '羽绒' },
  'down': { en: 'Down', zh: '羽绒' },
  'шерстяной': { en: 'Wool', zh: '羊毛' },
  'wool': { en: 'Wool', zh: '羊毛' },
  'кашемир': { en: 'Cashmere', zh: '羊绒' },
  'cashmere': { en: 'Cashmere', zh: '羊绒' },
  'вискоз': { en: 'Viscose', zh: '粘胶' },
  'эластан': { en: 'Elastane', zh: '氨纶' },
  'спандекс': { en: 'Spandex', zh: '弹力纤维' },
  'спец': { en: 'Special', zh: '特种' },
  'special': { en: 'Special', zh: '特种' },
  'уникальный': { en: 'Unique', zh: '独特' },
  'unique': { en: 'Unique', zh: '独特' },
  'редкий': { en: 'Rare', zh: '稀有' },
  'rare': { en: 'Rare', zh: '稀有' },
  'коллекцион': { en: 'Collection', zh: '收藏' },
  'collection': { en: 'Collection', zh: '收藏' },
  'винтаж': { en: 'Vintage', zh: '复古' },
  'vintage': { en: 'Vintage', zh: '复古' },
  'ретро': { en: 'Retro', zh: '怀旧' },
  'retro': { en: 'Retro', zh: '怀旧' },
  'модерн': { en: 'Modern', zh: '现代' },
  'минимализм': { en: 'Minimalism', zh: '极简' },
  'минималистичный': { en: 'Minimalist', zh: '极简' },
  'хай-тек': { en: 'Hi-tech', zh: '高科技' },
  'лофт': { en: 'Loft', zh: '阁楼风' },
  'скандинавский': { en: 'Scandinavian', zh: '北欧风' },
  'прованс': { en: 'Provence', zh: '普罗旺斯风' },
  'кантри': { en: 'Country', zh: '乡村风' },
  'country': { en: 'Country', zh: '乡村风' },
  'восточный': { en: 'Oriental', zh: '东方风' },
  'европейский': { en: 'European', zh: '欧式' },
  'european': { en: 'European', zh: '欧式' },
  'американский': { en: 'American', zh: '美式' },
  'american': { en: 'American', zh: '美式' },
  'азиатский': { en: 'Asian', zh: '亚洲' },
  'asian': { en: 'Asian', zh: '亚洲' },
  'традиционный': { en: 'Traditional', zh: '传统' },
  'traditional': { en: 'Traditional', zh: '传统' },
  'национальный': { en: 'National', zh: '民族' },
  'праздничный': { en: 'Festive', zh: '节日' },
  'свадебный': { en: 'Wedding', zh: '婚礼' },
  'wedding': { en: 'Wedding', zh: '婚礼' },
  'новогодний': { en: 'New Year', zh: '新年' },
  'рождественский': { en: 'Christmas', zh: '圣诞' },
  'christmas': { en: 'Christmas', zh: '圣诞' },
  'летний': { en: 'Summer', zh: '夏季' },
  'summer': { en: 'Summer', zh: '夏季' },
  'зимний': { en: 'Winter', zh: '冬季' },
  'winter': { en: 'Winter', zh: '冬季' },
  'весенний': { en: 'Spring', zh: '春季' },
  'spring': { en: 'Spring', zh: '春季' },
  'осенний': { en: 'Autumn', zh: '秋季' },
  'autumn': { en: 'Autumn', zh: '秋季' },
  'демисезонный': { en: 'Demiseason', zh: '春秋' },
  'всесезонный': { en: 'All-season', zh: '四季' },
  'повседневный': { en: 'Casual', zh: '日常' },
  'casual': { en: 'Casual', zh: '日常' },
  'спортивный': { en: 'Sport', zh: '运动' },
  'sport': { en: 'Sport', zh: '运动' },
  'деловой': { en: 'Business', zh: '商务' },
  'business': { en: 'Business', zh: '商务' },
  'вечерний': { en: 'Evening', zh: '晚装' },
  'выходной': { en: 'Weekend', zh: '休闲' },
  'активный': { en: 'Active', zh: '活力' },
  'active': { en: 'Active', zh: '活力' },
  'пассивный': { en: 'Passive', zh: '被动' },
  'ручной_управление': { en: 'Manual Control', zh: '手动控制' },
  'автоуправление': { en: 'Auto Control', zh: '自动控制' },
  'программируемый': { en: 'Programmable', zh: '可编程' },
  'programmable': { en: 'Programmable', zh: '可编程' },
  'самоочищающийся': { en: 'Self-cleaning', zh: '自清洁' },
  'самоустанавливающийся': { en: 'Self-adjusting', zh: '自适应' },
  'самоклеящийся': { en: 'Self-adhesive', zh: '自粘' },
  'самокат': { en: 'Scooter', zh: '滑板车' },
  'велосипед': { en: 'Bicycle', zh: '自行车' },
  'bicycle': { en: 'Bicycle', zh: '自行车' },
  'скейтборд': { en: 'Skateboard', zh: '滑板' },
  'ролики': { en: 'Roller Skates', zh: '轮滑' },
  'лыжи': { en: 'Skis', zh: '滑雪板' },
  'сноуборд': { en: 'Snowboard', zh: '单板' },
  'санки': { en: 'Sled', zh: '雪橇' },
  'палатка': { en: 'Tent', zh: '帐篷' },
  'tent': { en: 'Tent', zh: '帐篷' },
  'спальник': { en: 'Sleeping Bag', zh: '睡袋' },
  'фляга': { en: 'Flask', zh: '水壶' },
  'термос': { en: 'Thermos', zh: '保温杯' },
  'thermos': { en: 'Thermos', zh: '保温杯' },
  'удочка': { en: 'Fishing Rod', zh: '鱼竿' },
  'мяч': { en: 'Ball', zh: '球' },
  'ball': { en: 'Ball', zh: '球' },
  'ракетка': { en: 'Racket', zh: '球拍' },
  'гантель': { en: 'Dumbbell', zh: '哑铃' },
  'штанга': { en: 'Barbell', zh: '杠铃' },
  'эспандер': { en: 'Expander', zh: '拉力器' },
  'скакалка': { en: 'Jump Rope', zh: '跳绳' },
  'бассейн': { en: 'Pool', zh: '泳池' },
  'pool': { en: 'Pool', zh: '泳池' },
  'велотренажер': { en: 'Exercise Bike', zh: '动感单车' },
  'беговая': { en: 'Treadmill', zh: '跑步机' },
  'treadmill': { en: 'Treadmill', zh: '跑步机' },
  'эллиптический': { en: 'Elliptical', zh: '椭圆机' },
  'степпер': { en: 'Stepper', zh: '踏步机' },
  'гребной': { en: 'Rowing', zh: '划船机' },
  'йога': { en: 'Yoga', zh: '瑜伽' },
  'yoga': { en: 'Yoga', zh: '瑜伽' },
  'пилатес': { en: 'Pilates', zh: '普拉提' },
  'фитнес': { en: 'Fitness', zh: '健身' },
  'fitness': { en: 'Fitness', zh: '健身' },
  'аэробика': { en: 'Aerobics', zh: '有氧' },
  'растяжка': { en: 'Stretching', zh: '拉伸' },
  'медитация': { en: 'Meditation', zh: '冥想' },
  'релакс': { en: 'Relax', zh: '放松' },
  'релаксация': { en: 'Relaxation', zh: '放松' },
  'терапия': { en: 'Therapy', zh: '治疗' },
  'therapy': { en: 'Therapy', zh: '治疗' },
  'процедура': { en: 'Procedure', zh: '疗程' },
  'лечение': { en: 'Treatment', zh: '治疗' },
  'treatment': { en: 'Treatment', zh: '治疗' },
  'диагностик': { en: 'Diagnostics', zh: '诊断' },
  'профилактик': { en: 'Prevention', zh: '预防' },
  'реабилитация': { en: 'Rehabilitation', zh: '康复' },
  'ортопедический': { en: 'Orthopedic', zh: '骨科' },
  'orthopedic': { en: 'Orthopedic', zh: '骨科' },
  'эргономичный': { en: 'Ergonomic', zh: '人体工学' },
  'ergonomic': { en: 'Ergonomic', zh: '人体工学' },
  'анатомический': { en: 'Anatomical', zh: '解剖学' },
  'ортопед': { en: 'Orthopedic', zh: '矫形' },
  'корсет': { en: 'Corset', zh: '束腰' },
  'бандаж': { en: 'Bandage', zh: '绷带' },
  'суппорт': { en: 'Support', zh: '支撑' },
  'support': { en: 'Support', zh: '支撑' },
  'фиксатор': { en: 'Fixator', zh: '固定器' },
  'тренажер': { en: 'Trainer', zh: '训练器' },
  'тренировк': { en: 'Training', zh: '训练' },
  'training': { en: 'Training', zh: '训练' },
  'разминка': { en: 'Warm-up', zh: '热身' },
  'заминка': { en: 'Cool-down', zh: '放松' },
  'восстановлен': { en: 'Recovery', zh: '恢复' },
  'recovery': { en: 'Recovery', zh: '恢复' },
  'энергия': { en: 'Energy', zh: '能量' },
  'energy': { en: 'Energy', zh: '能量' },
  'сила': { en: 'Power', zh: '力量' },
  'power': { en: 'Power', zh: '力量' },
  'скорость': { en: 'Speed', zh: '速度' },
  'speed': { en: 'Speed', zh: '速度' },
  'выносливость': { en: 'Endurance', zh: '耐力' },
  'гибкость': { en: 'Flexibility', zh: '柔韧' },
  'координация': { en: 'Coordination', zh: '协调' },
  'баланс': { en: 'Balance', zh: '平衡' },
  'balance': { en: 'Balance', zh: '平衡' },
  'устойчивость': { en: 'Stability', zh: '稳定' },
  'stability': { en: 'Stability', zh: '稳定' },
  'безопасность': { en: 'Security', zh: '安全' },
  'security': { en: 'Security', zh: '安全' },
  'защитный': { en: 'Protective', zh: '防护' },
  'protective': { en: 'Protective', zh: '防护' },
  'экранированный': { en: 'Shielded', zh: '屏蔽' },
  'изолированный': { en: 'Insulated', zh: '绝缘' },
  'insulated': { en: 'Insulated', zh: '绝缘' },
  'герметичный': { en: 'Sealed', zh: '密封' },
  'sealed': { en: 'Sealed', zh: '密封' },
  'огнеупорный': { en: 'Fireproof', zh: '防火' },
  'fireproof': { en: 'Fireproof', zh: '防火' },
  'огнестойкий': { en: 'Fire-resistant', zh: '阻燃' },
  'термостойкий': { en: 'Heat-resistant', zh: '耐热' },
  'морозостойкий': { en: 'Frost-resistant', zh: '耐寒' },
  'износостойкий': { en: 'Wear-resistant', zh: '耐磨' },
  'химстойкий': { en: 'Chemical-resistant', zh: '耐化学' },
  'коррозионностойкий': { en: 'Corrosion-resistant', zh: '耐腐蚀' },
  'антивандальный': { en: 'Vandal-proof', zh: '防破坏' },
  'ударопрочный': { en: 'Shockproof', zh: '防震' },
  'shockproof': { en: 'Shockproof', zh: '防震' },
  'виброустойчивый': { en: 'Vibration-resistant', zh: '抗振' },
  'airwrap': { en: 'Airwrap', zh: '气流卷发器' },
  'supersonic': { en: 'Supersonic', zh: '超音速吹风机' },
  'co-anda': { en: 'Coanda', zh: '康达效应' },
  'booster': { en: 'Booster', zh: '增压' },
  'nural': { en: 'Nural', zh: '智能感应' },
  'jasper': { en: 'Jasper', zh: '碧玉色' },
  'plum': { en: 'Plum', zh: '梅紫色' },
  'pocket': { en: 'Pocket', zh: '口袋便携' },
  'complete': { en: 'Complete', zh: '完整套装' },
  'long': { en: 'Long', zh: '长发款' },
  'hair': { en: 'Hair', zh: '美发' },
  'опт': { en: 'Wholesale', zh: '批发' },
  'автомобил': { en: 'Automotive', zh: '车载' },
  'hs09': { en: 'Dyson HS09', zh: '戴森HS09' },
  'hd16': { en: 'Dyson HD16', zh: '戴森HD16' },
  'hs08': { en: 'Dyson HS08', zh: '戴森HS08' },
  'tf64': { en: 'Dyson TF64', zh: '戴森TF64' },
  'hd08': { en: 'Dyson HD08', zh: '戴森HD08' },
  'hd17': { en: 'Dyson HD17', zh: '戴森HD17' },
  'hd15': { en: 'Dyson HD15', zh: '戴森HD15' },
  'hs05': { en: 'Dyson HS05', zh: '戴森HS05' },
  'hd07': { en: 'Dyson HD07', zh: '戴森HD07' },
  '30шт': { en: '30pcs', zh: '30件装' },
  '10шт': { en: '10pcs', zh: '10件装' },
  '5шт': { en: '5pcs', zh: '5件装' },
  'high-speed': { en: 'High-speed', zh: '高速' },
  '5в1': { en: '5-in-1', zh: '5合1' },
  '8в1': { en: '8-in-1', zh: '8合1' },
  '3в1': { en: '3-in-1', zh: '3合1' },
  '4в1': { en: '4-in-1', zh: '4合1' },
  '6в1': { en: '6-in-1', zh: '6合1' },
  '7в1': { en: '7-in-1', zh: '7合1' },
  '2в1': { en: '2-in-1', zh: '2合1' },
  'в1': { en: '-in-1', zh: '合1' },
  'шт': { en: 'pcs', zh: '件' },
  'восстанавливающ': { en: 'Restoring', zh: '修复' },
  'увлажняющ': { en: 'Moisturizing', zh: '保湿' },
  'питательн': { en: 'Nourishing', zh: '滋养' },
  'поврежден': { en: 'Damaged', zh: '受损' },
  'сух': { en: 'Dry', zh: '干性' },
  'окрашен': { en: 'Colored/Dyed', zh: '染后' },
  'выпаден': { en: 'Hair loss', zh: '防脱' },
  'кератин': { en: 'Keratin', zh: '角蛋白' },
  'коллаген': { en: 'Collagen', zh: '胶原蛋白' },
  'липидн': { en: 'Lipid', zh: '脂质' },
  'питани': { en: 'Nutrition', zh: '营养' },
  'интенсивн': { en: 'Intensive', zh: '深层/强效' },
  'бальзам': { en: 'Balm/Conditioner', zh: '护发素' },
  'ботокс': { en: 'Botox', zh: '头发水光针' },
  'кудряв': { en: 'Curly', zh: '卷发' },
  'аминокислот': { en: 'Amino acid', zh: '氨基酸' },
  'кислот': { en: 'Acid', zh: '酸' },
  'голов': { en: 'Head', zh: '头部' },
  'уход': { en: 'Care', zh: '护理' },
  'ухода': { en: 'Care', zh: '护理' },
  'несмываем': { en: 'Leave-in', zh: '免洗' },
  'объем': { en: 'Volume', zh: '丰盈' },
  'объема': { en: 'Volume', zh: '丰盈' },
  'двухфазн': { en: 'Two-phase', zh: '双效' },
  'сыворотк': { en: 'Serum', zh: '精华' },
  'солев': { en: 'Salt', zh: '海盐' },
  'мист': { en: 'Mist', zh: '喷雾' },
  'тип': { en: 'Type', zh: '类型' },
  'перц': { en: 'Pepper', zh: '辣椒' },
  'mixit': { en: 'Mixit', zh: 'Mixit品牌' },
  'tashe': { en: 'Tashe', zh: 'Tashe品牌' },
  'loreal': { en: "L'Oreal", zh: '欧莱雅' },
  'elseve': { en: 'Elseve', zh: '欧莱雅Elseve' },
  'estel': { en: 'Estel', zh: 'Estel品牌' },
  'ollin': { en: 'Ollin', zh: 'Ollin品牌' },
  'siberica': { en: 'Natura Siberica', zh: '西伯利亚品牌' },
  'tefia': { en: 'Tefia', zh: 'Tefia品牌' },
  'paris': { en: 'Paris', zh: '巴黎' },
  'repair': { en: 'Repair', zh: '修复' },
  'expert': { en: 'Expert', zh: '专家级' },
  'sos': { en: 'SOS', zh: '急救' },
  'for': { en: 'For', zh: '适用' },
  'ice': { en: 'Ice', zh: '冰感' },
  'perfect': { en: 'Perfect', zh: '完美' },
  'constant': { en: 'Constant', zh: 'Constant品牌' },
  'delight': { en: 'Delight', zh: 'Delight系列' },
  'mariee': { en: 'Mariee', zh: 'Mariee品牌' },
  '500мл': { en: '500ml', zh: '500毫升' },
  '300мл': { en: '300ml', zh: '300毫升' },
  '200мл': { en: '200ml', zh: '200毫升' },
  '250мл': { en: '250ml', zh: '250毫升' },
  '100мл': { en: '100ml', zh: '100毫升' },
  '150мл': { en: '150ml', zh: '150毫升' },
  'мл': { en: 'ml', zh: '毫升' },
  'сн': { en: 'Sleep', zh: '睡眠' },
  'памят': { en: 'Memory', zh: '记忆棉' },
  'памятью': { en: 'Memory', zh: '记忆棉' },
  'взросл': { en: 'Adult', zh: '成人' },
  'наволоч': { en: 'Pillowcase', zh: '枕套' },
  'форм': { en: 'Shape/Form', zh: '形状' },
  'ног': { en: 'Legs', zh: '腿部' },
  'шеи': { en: 'Neck', zh: '颈部' },
  'подростк': { en: 'Teenager', zh: '青少年' },
  'поддержк': { en: 'Support', zh: '支撑' },
  'валик': { en: 'Roller', zh: '圆柱枕' },
  'гречнев': { en: 'Buckwheat', zh: '荞麦' },
  'memory': { en: 'Memory', zh: '记忆棉' },
  'foam': { en: 'Foam', zh: '海绵' },
  'dream': { en: 'Dream', zh: '睡眠' },
  'pappus': { en: 'Pappus', zh: 'Pappus品牌' },
  'somnolab': { en: 'Somnolab', zh: 'Somnolab品牌' },
  'sonyasleep': { en: 'Sonyasleep', zh: 'Sonyasleep品牌' },
  'memorysleep': { en: 'MemorySleep', zh: 'MemorySleep品牌' },
  '50х70': { en: '50x70cm', zh: '50x70厘米' },
  '40х60': { en: '40x60cm', zh: '40x60厘米' },
  '60х40': { en: '60x40cm', zh: '60x40厘米' },
  '30x50': { en: '30x50cm', zh: '30x50厘米' },
  '50x70': { en: '50x70cm', zh: '50x70厘米' },
  '40x60': { en: '40x60cm', zh: '40x60厘米' },
  '60x40': { en: '60x40cm', zh: '60x40厘米' },
  'см': { en: 'cm', zh: '厘米' },
  'ламинирован': { en: 'Lamination', zh: '角蛋白护理' },
  'ламиниров': { en: 'Lamination', zh: '角蛋白护理' },
  'термозащит': { en: 'Heat protection', zh: '防热损伤' },
  'высот': { en: 'Height', zh: '高度' },
  'эффект': { en: 'Effect', zh: '功效' },
  'просто': { en: 'Simple', zh: '简约' },
  'анатом': { en: 'Anatomical', zh: '人体工学' },
  'жестк': { en: 'Firm', zh: '硬质' },
  'пружин': { en: 'Spring', zh: '弹簧' },
  'наполнитель': { en: 'Filler', zh: '填充物' },
  'наполнител': { en: 'Filler', zh: '填充物' },
  'холлофайбер': { en: 'Hollofayber', zh: '中空纤维' },
  'латекс': { en: 'Latex', zh: '乳胶' },
  'пенополиуретан': { en: 'Polyurethane foam', zh: '聚氨酯海绵' },
  'эргономич': { en: 'Ergonomic', zh: '人体工学' },
  'изголовь': { en: 'Headboard', zh: '床头' },
  'шейн': { en: 'Cervical', zh: '颈椎' },
  'пояснич': { en: 'Lumbar', zh: '腰椎' },
  'ортопедическ': { en: 'Orthopedic', zh: '矫形' },
  'бархат': { en: 'Velvet', zh: '丝绒' },
  'микроволокн': { en: 'Microfiber', zh: '超细纤维' },
  '34x41': { en: '34x41cm', zh: '34x41厘米' },
  '60х40х11': { en: '60x40x11cm', zh: '60x40x11厘米' },
  '50х70см': { en: '50x70cm', zh: '50x70厘米' },
  '40x60см': { en: '40x60cm', zh: '40x60厘米' },
  '30x50см': { en: '30x50cm', zh: '30x50厘米' },
  '60х40см': { en: '60x40cm', zh: '60x40厘米' },
  '50x70см': { en: '50x70cm', zh: '50x70厘米' },
  '34x41см': { en: '34x41cm', zh: '34x41厘米' },
  'укладки': { en: 'Styling', zh: '造型' },
  'термозащитный': { en: 'Heat-protective', zh: '防热损伤' },
  'блеск': { en: 'Shine', zh: '光泽' },
  'блеском': { en: 'Shine', zh: '光泽' },
  'сияни': { en: 'Radiance', zh: '闪耀' },
  'шелковист': { en: 'Silky', zh: '丝滑' },
  'гладк': { en: 'Smooth', zh: '顺滑' },
  'эластичн': { en: 'Elastic', zh: '弹性' },
  'послушн': { en: 'Manageable', zh: '柔顺' },
  'зеркальн': { en: 'Mirror-like', zh: '镜面光泽' },
  'реконструкц': { en: 'Reconstruction', zh: '重建修复' },
  'маска': { en: 'Mask', zh: '发膜' },
  'маской': { en: 'Mask', zh: '发膜' },
  'маску': { en: 'Mask', zh: '发膜' },
  'ополаскивател': { en: 'Rinse', zh: '冲洗型护发' },
  'ламинировани': { en: 'Lamination', zh: '角蛋白护理' },
  'выпрямлен': { en: 'Straightened', zh: '拉直' },
  'завивк': { en: 'Perm', zh: '烫发' },
  'тонирован': { en: 'Toning', zh: '调色' },
  'мелирован': { en: 'Highlighting', zh: '挑染' },
  'обесцвечиван': { en: 'Bleaching', zh: '漂发' },
  'кератинов': { en: 'Keratin', zh: '角蛋白' },
  'горячий': { en: 'Hot', zh: '热' },
  'холодн': { en: 'Cold', zh: '冷色调' },
  'вьющ': { en: 'Curly', zh: '卷曲' },
  'порист': { en: 'Porous', zh: '多孔' },
  'тускл': { en: 'Dull', zh: '暗哑' },
  'секущ': { en: 'Split ends', zh: '分叉' },
  'ломк': { en: 'Brittle', zh: '易断' },
  'электризу': { en: 'Static', zh: '静电' },
  'пушащ': { en: 'Frizzy', zh: '毛躁' },
  'флюид': { en: 'Fluid', zh: '精华液' },
  'комплекс': { en: 'Complex', zh: '复合配方' },
  'витаминн': { en: 'Vitamin', zh: '维他命' },
  'маслянист': { en: 'Oily', zh: '油性' },
  'спирт': { en: 'Alcohol', zh: '酒精' },
  'безсульфатн': { en: 'Sulfate-free', zh: '无硫酸盐' },
  'сульфат': { en: 'Sulfate', zh: '硫酸盐' },
  'парабен': { en: 'Paraben', zh: '防腐剂' },
  'пантенол': { en: 'Panthenol', zh: '泛醇' },
  'биотин': { en: 'Biotin', zh: '生物素' },
  'маслом': { en: 'Oil', zh: '精油' },
  'арганов': { en: 'Argan', zh: '摩洛哥坚果' },
  'касторов': { en: 'Castor', zh: '蓖麻' },
  'кокосов': { en: 'Coconut', zh: '椰子' },
  'репейн': { en: 'Burdock', zh: '牛蒡' },
  'миндальн': { en: 'Almond', zh: '杏仁' },
  'жожоб': { en: 'Jojoba', zh: '荷荷巴' },
  'макадам': { en: 'Macadamia', zh: '夏威夷果' },
  'ши': { en: 'Shea', zh: '乳木果' },
  'экстракт': { en: 'Extract', zh: '提取物' },
  'алоэ': { en: 'Aloe', zh: '芦荟' },
  'ромашк': { en: 'Chamomile', zh: '洋甘菊' },
  'крапив': { en: 'Nettle', zh: '荨麻' },
  'хн': { en: 'Henna', zh: '指甲花' },
  'басма': { en: 'Basma', zh: '靛蓝草' },
  'подарочн': { en: 'Gift', zh: '礼盒装' },
  'дозатор': { en: 'Dispenser', zh: '按压泵' },
  'саше': { en: 'Sachet', zh: '小包装' },
  'пробник': { en: 'Sample', zh: '试用装' },
  'миниатюр': { en: 'Miniature', zh: '迷你装' },
  'сна': { en: 'Sleep', zh: '睡眠' },
  'сном': { en: 'Sleep', zh: '睡眠' },
  'лет': { en: 'Years', zh: '年龄段' },
  'рост': { en: 'Growth', zh: '增长' },
  'роста': { en: 'Growth', zh: '增长' },
  'высота': { en: 'Height', zh: '高度' },
  'высотой': { en: 'Height', zh: '高度' },
  'эффектом': { en: 'With effect', zh: '功效' },
  'эффекта': { en: 'Effect', zh: '功效' },
  'прочн': { en: 'Durable', zh: '耐用' },
  'двухъярусн': { en: 'Two-tier', zh: '双层' },
  'с эффектом': { en: 'With effect', zh: '带功效' },
  'с памятью': { en: 'With memory', zh: '记忆棉' },
  'с массажем': { en: 'With massage', zh: '带按摩' },
  'на молнии': { en: 'With zipper', zh: '拉链式' },
  'в чехле': { en: 'In cover', zh: '带枕套' },
  'с наволочкой': { en: 'With pillowcase', zh: '含枕套' },
  'для сна': { en: 'For sleep', zh: '助眠' },
  'для шеи': { en: 'For neck', zh: '护颈' },
  'для спины': { en: 'For back', zh: '护背' },
  'для поясницы': { en: 'For lower back', zh: '护腰' },
  'для ног': { en: 'For legs', zh: '腿部支撑' },
  'для беременных': { en: 'For pregnant', zh: '孕妇' },
  'для путешествий': { en: 'For travel', zh: '旅行用' },
  'для детей': { en: 'For kids', zh: '儿童' },
  'для взрослых': { en: 'For adults', zh: '成人' },
  'для подростков': { en: 'For teens', zh: '青少年' },
  'для бокового': { en: 'For side', zh: '侧睡' },
  'для спины-2': { en: 'For back sleeping', zh: '仰睡' },
  'для живота': { en: 'For stomach', zh: '趴睡' },
  'жесткости': { en: 'Firmness', zh: '硬度' },
  'средней': { en: 'Medium', zh: '中等' },
  'мягкости': { en: 'Softness', zh: '柔软度' },
  'умеренной': { en: 'Moderate', zh: '适中' },
  'комфорт': { en: 'Comfort', zh: '舒适' },
  'комфортн': { en: 'Comfortable', zh: '舒适' },
  'здоров': { en: 'Healthy', zh: '健康' },
  'качеств': { en: 'Quality', zh: '品质' },
  'классик': { en: 'Classic', zh: '经典' },
  'эконом': { en: 'Economy', zh: '经济' },
  'дышащ': { en: 'Breathable', zh: '透气' },
  'вентиляция': { en: 'Ventilation', zh: '通风' },
  'охлажд': { en: 'Cooling', zh: '凉感' },
  'охлаждающ': { en: 'Cooling', zh: '凉感' },
  'анатомическ': { en: 'Anatomical', zh: '人体工学' },
  'волновидн': { en: 'Wave-shaped', zh: '波浪形' },
  'контурн': { en: 'Contour', zh: '轮廓型' },
  'сердцевидн': { en: 'Heart-shaped', zh: '心形' },
  'косточк': { en: 'Bone-shaped', zh: '骨形枕' },
  'полумесяц': { en: 'Crescent', zh: '月牙形' },
  'трапециевидн': { en: 'Trapezoidal', zh: '梯形' },
  'прямоугольник': { en: 'Rectangle', zh: '矩形' },
  'квадратн': { en: 'Square', zh: '方形' },
  'кругл': { en: 'Round', zh: '圆形' },
  'ролик': { en: 'Roller', zh: '圆柱枕' },
  'трансформер': { en: 'Transformer', zh: '可变形' },
  'составн': { en: 'Composite', zh: '组合式' },
  'съемн': { en: 'Removable', zh: '可拆卸' },
  'регулир': { en: 'Adjustable', zh: '可调节' },
  'машинн': { en: 'Machine', zh: '机洗' },
  'стирк': { en: 'Wash', zh: '可水洗' },
  'чистк': { en: 'Cleaning', zh: '清洁' },
  'производств': { en: 'Production', zh: '生产' },
  'российск': { en: 'Russian', zh: '俄罗斯' },
  'импортн': { en: 'Imported', zh: '进口' },
  'отечествен': { en: 'Domestic', zh: '国产' },
  'китайск': { en: 'Chinese', zh: '中国' },
  'пух': { en: 'Down', zh: '羽绒' },
  'пухом': { en: 'Down', zh: '羽绒' },
  'лебяжий': { en: 'Swan down', zh: '鹅绒' },
  'лебяжь': { en: 'Swan down', zh: '鹅绒' },
  '2шт': { en: '2pcs', zh: '2件装' },
  '1шт': { en: '1pc', zh: '1件装' },
  '70х70': { en: '70x70cm', zh: '70x70厘米' },
  '70х70см': { en: '70x70cm', zh: '70x70厘米' },
  '70x70см': { en: '70x70cm', zh: '70x70厘米' },
  'тика': { en: 'Tik fabric', zh: '缇卡棉布' },
  'тик': { en: 'Tik fabric', zh: '缇卡棉布' },
  'аэросетк': { en: 'Air mesh', zh: '透气网面' },
  'беременн': { en: 'Pregnant', zh: '孕妇' },
  'эвкалипт': { en: 'Eucalyptus', zh: '桉树' },
  'упруг': { en: 'Elastic', zh: '弹性' },
  'новорожденн': { en: 'Newborn', zh: '新生儿' },
  'овечь': { en: 'Sheep wool', zh: '羊毛' },
  'овечья': { en: 'Sheep wool', zh: '羊毛' },
  'волокн': { en: 'Fiber', zh: '纤维' },
  'силиконизированн': { en: 'Siliconized', zh: '硅化纤维' },
  'тканев': { en: 'Fabric', zh: '织物' },
  'хлопков': { en: 'Cotton', zh: '棉质' },
  'покрыт': { en: 'Covered', zh: '覆面' },
  'чехлом': { en: 'Cover', zh: '保护套' },
  'наперник': { en: 'Inner cover', zh: '内胆套' },
  'наперником': { en: 'Inner cover', zh: '内胆套' },
  'простежк': { en: 'Quilting', zh: '绗缝' },
  'простеганн': { en: 'Quilted', zh: '绗缝' },
  'стеган': { en: 'Quilted', zh: '绗缝' },
  'камер': { en: 'Chamber', zh: '分区' },
  'камерн': { en: 'Chamber', zh: '分区' },
  'трехкамерн': { en: '3-chamber', zh: '三分区' },
  'двухкамерн': { en: '2-chamber', zh: '二分区' },
  'смесов': { en: 'Blend', zh: '混纺' },
  'смесовой': { en: 'Blended', zh: '混纺' },
  'искусственног': { en: 'Artificial', zh: '人造' },
  'упаковк': { en: 'Packaging', zh: '包装' },
  'вакуумн': { en: 'Vacuum', zh: '真空包装' },
  'рулон': { en: 'Roll', zh: '卷装' },
  'подушечк': { en: 'Small pillow', zh: '小枕头' },
  'декоративн': { en: 'Decorative', zh: '装饰' },
  'думочк': { en: 'Cushion', zh: '靠垫' },
  'подголовник': { en: 'Headrest', zh: '头枕' },
  'под шею': { en: 'Under neck', zh: '护颈' },
  'под голову': { en: 'Under head', zh: '头部支撑' },
  'под спину': { en: 'Under back', zh: '护腰' },
  'антистресс': { en: 'Anti-stress', zh: '减压' },
  'ароматерапевт': { en: 'Aromatherapy', zh: '香薰' },
  'трав': { en: 'Herbs', zh: '草本' },
  'лаванд': { en: 'Lavender', zh: '薰衣草' },
  'хмель': { en: 'Hops', zh: '啤酒花' },
  'полын': { en: 'Wormwood', zh: '艾草' },
  'мят': { en: 'Mint', zh: '薄荷' },
  'сезонн': { en: 'Seasonal', zh: '季节' },
  'зимн': { en: 'Winter', zh: '冬季' },
  'летн': { en: 'Summer', zh: '夏季' },
  'всесезонн': { en: 'All-season', zh: '四季' },
  'охлажден': { en: 'Cooling', zh: '凉感' },
  'гелев': { en: 'Gel', zh: '凝胶' },
  'гелем': { en: 'Gel', zh: '凝胶' },
  'гелевым': { en: 'Gel', zh: '凝胶' },
  'одноразовые': { en: 'Disposable', zh: '一次性' },
  'нитриловые': { en: 'Nitrile', zh: '丁腈' },
  'хозяйственные': { en: 'Household', zh: '家务用' },
  'неопудренные': { en: 'Unpowdered', zh: '无粉' },
  'текстурированные': { en: 'Textured', zh: '纹理防滑' },
  'латексные': { en: 'Latex', zh: '乳胶' },
  'виниловые': { en: 'Vinyl', zh: '乙烯基' },
  'винилово-нитриловые': { en: 'Vinyl-nitrile', zh: '乙烯基丁腈' },
  'винила': { en: 'Vinyl', zh: '乙烯基' },
  'винилом': { en: 'Vinyl', zh: '乙烯基' },
  'смотровые': { en: 'Examination', zh: '检查用' },
  'хирургические': { en: 'Surgical', zh: '外科手术用' },
  'парикмахерские': { en: 'Hairdressing', zh: '美发用' },
  'косметические': { en: 'Cosmetic', zh: '美容用' },
  'прочные': { en: 'Durable', zh: '加厚耐用' },
  'многоразовые': { en: 'Reusable', zh: '可重复使用' },
  'резиновые': { en: 'Rubber', zh: '橡胶' },
  'хлопковые': { en: 'Cotton', zh: '纯棉' },
  'прозрачные': { en: 'Transparent', zh: '透明' },
  'голубые': { en: 'Blue', zh: '蓝色' },
  'черные': { en: 'Black', zh: '黑色' },
  'белые': { en: 'White', zh: '白色' },
  'серые': { en: 'Gray', zh: '灰色' },
  'бежевые': { en: 'Beige', zh: '米色' },
  'зеленые': { en: 'Green', zh: '绿色' },
  'уборки': { en: 'Cleaning', zh: '清洁' },
  'мойки': { en: 'Washing', zh: '洗车' },
  'кухни': { en: 'Kitchen', zh: '厨房用' },
  'садовые': { en: 'Garden', zh: '园艺用' },
  'покрытием': { en: 'Coated', zh: '涂层' },
  'добавлением': { en: 'With addition', zh: '含' },
  'плотность': { en: 'Density', zh: '密度' },
  'впитывающих': { en: 'Absorbent', zh: '吸汗' },
  'пот': { en: 'Sweat', zh: '汗' },
  'процедур': { en: 'Procedures', zh: '护理程序' },
  'двухсторонняя': { en: 'Double-sided', zh: '双面' },
  'тряпка': { en: 'Cloth', zh: '抹布' },
  'автомобиля': { en: 'Car', zh: '汽车' },
  'универсальная': { en: 'Universal', zh: '通用' },
  'чистюля': { en: 'Chistyulya', zh: '清洁品牌' },
  'бенови': { en: 'Benovy', zh: 'Benovy品牌' },
  'германия': { en: 'Germany', zh: '德国制造' },
  'восстанавливающая': { en: 'Restoring', zh: '修复型' },
  'увлажняющая': { en: 'Moisturizing', zh: '保湿型' },
  'профессиональная': { en: 'Professional', zh: '专业级' },
  'питательная': { en: 'Nourishing', zh: '滋养型' },
  'интенсивная': { en: 'Intensive', zh: '深层' },
  'несмываемая': { en: 'Leave-in', zh: '免洗型' },
  'тонирующая': { en: 'Toning', zh: '调色型' },
  'протеиновая': { en: 'Protein', zh: '蛋白型' },
  'силиконовая': { en: 'Silicone', zh: '硅胶型' },
  'многофункциональная': { en: 'Multifunctional', zh: '多功能' },
  'укрепляющий': { en: 'Strengthening', zh: '强韧型' },
  'поврежденных': { en: 'Damaged', zh: '受损发质' },
  'ослабленных': { en: 'Weakened', zh: '脆弱发质' },
  'ломких': { en: 'Brittle', zh: '易断发质' },
  'тонких': { en: 'Fine', zh: '细软发质' },
  'вьющихся': { en: 'Curly', zh: '卷发' },
  'осветленных': { en: 'Bleached', zh: '漂染发质' },
  'кудрявых': { en: 'Curly', zh: '卷曲发质' },
  'пористых': { en: 'Porous', zh: '多孔发质' },
  'локонов': { en: 'Curls', zh: '卷发' },
  'волосами': { en: 'Hair', zh: '发质' },
  'кератином': { en: 'Keratin', zh: '角蛋白' },
  'коллагеном': { en: 'Collagen', zh: '胶原蛋白' },
  'протеинами': { en: 'Proteins', zh: '蛋白质' },
  'маслами': { en: 'Oils', zh: '精油' },
  'никотиновой': { en: 'Nicotinic', zh: '烟酸' },
  'гиалуроновой': { en: 'Hyaluronic', zh: '玻尿酸' },
  'розмарином': { en: 'Rosemary', zh: '迷迭香' },
  'алоэ': { en: 'Aloe', zh: '芦荟' },
  'авокадо': { en: 'Avocado', zh: '牛油果' },
  'жожоба': { en: 'Jojoba', zh: '荷荷巴' },
  'кератин': { en: 'Keratin', zh: '角蛋白' },
  'укрепление': { en: 'Strengthening', zh: '强韧' },
  'восстановление': { en: 'Restoration', zh: '修复' },
  'роста': { en: 'Growth', zh: '增长/促生' },
  'цвета': { en: 'Color', zh: '色彩' },
  'блонд': { en: 'Blonde', zh: '金发' },
  'блонда': { en: 'Blonde', zh: '金发' },
  'мужчин': { en: 'Men', zh: '男士' },
  'средство': { en: 'Product/Remedy', zh: '产品' },
  'глубокое': { en: 'Deep', zh: '深层' },
  'фруктис': { en: 'Fructis', zh: 'Fructis系列' },
  'италия': { en: 'Italy', zh: '意大利' },
  'тела': { en: 'Body', zh: '身体' },
  'шелк': { en: 'Silk', zh: '丝绸' },
  'шампунь': { en: 'Shampoo', zh: '洗发水' },
  'спрей-термозащита': { en: 'Heat protection spray', zh: '防热喷雾' },
  'термозащита': { en: 'Heat protection', zh: '防热损伤' },
  'парфюмированное': { en: 'Perfumed', zh: '香氛型' },
  'предотвращает': { en: 'Prevents', zh: '预防' },
  'прикорневого': { en: 'Root', zh: '发根' },
  'объем': { en: 'Volume', zh: '丰盈' },
  'серия': { en: 'Series', zh: '系列' },
  'ортопедическая': { en: 'Orthopedic', zh: '矫形' },
  'анатомическая': { en: 'Anatomical', zh: '人体工学' },
  'памяти': { en: 'Memory', zh: '记忆棉' },
  'пух': { en: 'Down', zh: '羽绒' },
  'лебяжий': { en: 'Swan down', zh: '鹅绒' },
  'чехол': { en: 'Cover', zh: '枕套' },
  'волокно': { en: 'Fiber', zh: '纤维' },
  'жесткость': { en: 'Firmness', zh: '硬度' },
  'жёсткости': { en: 'Firmness', zh: '硬度' },
  'средняя': { en: 'Medium', zh: '中等' },
  'мягкая': { en: 'Soft', zh: '柔软' },
  'детская': { en: "Kids'", zh: '儿童' },
  'наполнителем': { en: 'Filled with', zh: '填充' },
  'гипоаллергенный': { en: 'Hypoallergenic', zh: '低敏' },
  'упругая': { en: 'Resilient', zh: '弹性' },
  'овечья': { en: 'Sheep', zh: '羊毛' },
  'фабрика': { en: 'Factory', zh: '工厂' },
  'эвкалипт': { en: 'Eucalyptus', zh: '桉树' },
  'полиэстер': { en: 'Polyester', zh: '聚酯纤维' },
  'гречневой': { en: 'Buckwheat', zh: '荞麦' },
  'валиков': { en: 'Rollers', zh: '圆柱枕' },
  'стул': { en: 'Chair', zh: '座椅' },
  'латекс': { en: 'Latex', zh: '乳胶' },
  '50х70': { en: '50x70cm', zh: '50x70厘米' },
  '70х70': { en: '70x70cm', zh: '70x70厘米' },
  '40х60': { en: '40x60cm', zh: '40x60厘米' },
  '60х40х11': { en: '60x40x11cm', zh: '60x40x11厘米' },
  '34x41см': { en: '34x41cm', zh: '34x41厘米' },
  '350мл': { en: '350ml', zh: '350毫升' },
  '500мл': { en: '500ml', zh: '500毫升' },
  '300мл': { en: '300ml', zh: '300毫升' },
  '100шт': { en: '100pcs', zh: '100只装' },
  '200шт': { en: '200pcs', zh: '200只装' },
  '2шт': { en: '2pcs', zh: '2只装' },
  'штук': { en: 'Pieces', zh: '只' },
  'сна': { en: 'Sleep', zh: '睡眠' },
  'высота': { en: 'Height', zh: '高度' },
  'эффектом': { en: 'With effect', zh: '功效' },
  'ухода': { en: 'Care', zh: '护理' },
  'уход': { en: 'Care', zh: '护理' },
  'маска': { en: 'Mask', zh: '发膜' },
  'спрей': { en: 'Spray', zh: '喷雾' },
  'мист': { en: 'Mist', zh: '水雾' },
  'подушка': { en: 'Pillow', zh: '枕头' },
  'волос': { en: 'Hair', zh: '头发' },
  'одноразовые': { en: 'Disposable', zh: '一次性' },
  'медицинские': { en: 'Medical', zh: '医疗级' },
  'гипоаллергенные': { en: 'Hypoallergenic', zh: '低敏' },
  'прочные': { en: 'Durable', zh: '加厚' },
  'без': { en: 'Without', zh: '无' },
  'набор': { en: 'Set', zh: '套装' },
  'комплект': { en: 'Kit', zh: '套装' },
  'упаковка': { en: 'Pack', zh: '包装' },
  'размер': { en: 'Size', zh: '尺码' },
  'цвет': { en: 'Color', zh: '颜色' },
  'количество': { en: 'Quantity', zh: '数量' },
  'вес': { en: 'Weight', zh: '重量' },
  'объем': { en: 'Volume', zh: '容量' },
  'длина': { en: 'Length', zh: '长度' },
  'ширина': { en: 'Width', zh: '宽度' },
  'высота': { en: 'Height', zh: '高度' },
  'материал': { en: 'Material', zh: '材质' },
  'состав': { en: 'Composition', zh: '成分' },
  'страна': { en: 'Country', zh: '国家' },
  'производитель': { en: 'Manufacturer', zh: '制造商' },
  'бренд': { en: 'Brand', zh: '品牌' },
  'модель': { en: 'Model', zh: '型号' },
  'арт': { en: 'SKU', zh: '货号' },
  'шт': { en: 'pcs', zh: '件' },
  'мл': { en: 'ml', zh: '毫升' },
  'см': { en: 'cm', zh: '厘米' },
  'г': { en: 'g', zh: '克' },
  'кг': { en: 'kg', zh: '千克' },
  'л': { en: 'L', zh: '升' },
  'м': { en: 'M', zh: '米' },
  'мм': { en: 'mm', zh: '毫米' },
  'экстракт': { en: 'Extract', zh: '提取物' },
  'масло': { en: 'Oil', zh: '油/精油' },
  'маслом': { en: 'Oil', zh: '精油' },
  'крем': { en: 'Cream', zh: '面霜' },
  'бальзам': { en: 'Conditioner', zh: '护发素' },
  'сыворотка': { en: 'Serum', zh: '精华' },
  'сыворотк': { en: 'Serum', zh: '精华' },
  'кондиционер': { en: 'Conditioner', zh: '护发素' },
  'лак': { en: 'Hairspray', zh: '定型喷雾' },
  'пена': { en: 'Mousse', zh: '摩丝' },
  'воск': { en: 'Wax', zh: '发蜡' },
  'гель': { en: 'Gel', zh: '凝胶' },
  'паста': { en: 'Paste', zh: '发膏' },
  'пудра': { en: 'Powder', zh: '粉饼' },
  'мусс': { en: 'Mousse', zh: '慕斯' },
  'флюид': { en: 'Fluid', zh: '精华液' },
  'маска для волос': { en: 'Hair mask', zh: '发膜' },
  'спрей для волос': { en: 'Hair spray', zh: '护发喷雾' },
  'шампунь для волос': { en: 'Hair shampoo', zh: '洗发水' },
  'бальзам для волос': { en: 'Hair conditioner', zh: '护发素' },
  'подушка для сна': { en: 'Sleeping pillow', zh: '睡眠枕' },
  'подушка ортопедическая': { en: 'Orthopedic pillow', zh: '矫形枕' },
  'для волос': { en: 'For hair', zh: '护发' },
  'для роста волос': { en: 'For hair growth', zh: '促生发' },
  'от выпадения': { en: 'Against hair loss', zh: '防脱' },
  'для поврежденных': { en: 'For damaged', zh: '受损修护' },
  'для сухих': { en: 'For dry', zh: '干性适用' },
  'для окрашенных': { en: 'For colored', zh: '染后适用' },
  'для кудрявых': { en: 'For curly', zh: '卷发适用' },
  'с кератином': { en: 'With keratin', zh: '含角蛋白' },
  'с маслом': { en: 'With oil', zh: '含精油' },
  'с экстрактом': { en: 'With extract', zh: '含提取物' },
  'эффект ламинирования': { en: 'Lamination effect', zh: '角蛋白护理效果' },
  'эффект памяти': { en: 'Memory effect', zh: '记忆棉效果' },
  'лебяжий пух': { en: 'Swan down', zh: '鹅绒' },
  'средней жесткости': { en: 'Medium firmness', zh: '中等硬度' },
  'с эффектом памяти': { en: 'With memory effect', zh: '记忆棉' },
  'в чехле': { en: 'In cover', zh: '含枕套' },
  'для сна': { en: 'For sleep', zh: '助眠' },
  'красота': { en: 'Beauty', zh: '美容' },
  'здоровье': { en: 'Health', zh: '健康' },
  'гигиена': { en: 'Hygiene', zh: '卫生' },
  'чистота': { en: 'Cleanliness', zh: '洁净' },
  'защита': { en: 'Protection', zh: '防护' },
  'питание': { en: 'Nutrition', zh: '营养' },
  'увлажнение': { en: 'Moisturizing', zh: '保湿' },
  'восстановление': { en: 'Restoration', zh: '修复' },
  'укрепление': { en: 'Strengthening', zh: '强韧' },
  'объем': { en: 'Volume', zh: '丰盈' },
  'блеск': { en: 'Shine', zh: '光泽' },
  'гладкость': { en: 'Smoothness', zh: '顺滑' },
  'мягкость': { en: 'Softness', zh: '柔软' },
  'эластичность': { en: 'Elasticity', zh: '弹性' },
  'шелковистость': { en: 'Silkiness', zh: '丝滑' },
  'легкое расчесывание': { en: 'Easy combing', zh: '易梳理' },
  'антистатик': { en: 'Antistatic', zh: '抗静电' },
  'термозащита': { en: 'Heat protection', zh: '防热损伤' },
  'защита цвета': { en: 'Color protection', zh: '护色' },
  'стайлинг': { en: 'Styling', zh: '造型' },
  'фиксация': { en: 'Fixation', zh: '定型' },
  'укладка': { en: 'Styling', zh: '造型' },
  'завивка': { en: 'Perming', zh: '烫发' },
  'выпрямление': { en: 'Straightening', zh: '拉直' },
  'тонирование': { en: 'Toning', zh: '调色' },
  'мелирование': { en: 'Highlighting', zh: '挑染' },
  'обесцвечивание': { en: 'Bleaching', zh: '漂发' },
  'окрашивание': { en: 'Coloring', zh: '染发' },
  'насыщенный': { en: 'Rich', zh: '浓郁' },
  'стойкий': { en: 'Long-lasting', zh: '持久' },
  'мгновенный': { en: 'Instant', zh: '即时' },
  'экспресс': { en: 'Express', zh: '快速' },
  'глубокий': { en: 'Deep', zh: '深层' },
  'комплексный': { en: 'Comprehensive', zh: '综合' },
  'мультисенсорный': { en: 'Multisensory', zh: '多感官' },
  'ароматический': { en: 'Aromatic', zh: '芳香' },
  'охлаждающий': { en: 'Cooling', zh: '凉感' },
  'разогревающий': { en: 'Warming', zh: '热感' },
  'стимулирующий': { en: 'Stimulating', zh: '促生' },
  'тонизирующий': { en: 'Toning', zh: '焕活' },
  'омолаживающий': { en: 'Rejuvenating', zh: '抗衰' },
  'детокс': { en: 'Detox', zh: '排毒' },
  'скраб': { en: 'Scrub', zh: '磨砂' },
  'пилинг': { en: 'Peeling', zh: '去角质' },
  'обертывание': { en: 'Wrapping', zh: '裹敷' },
  'массаж': { en: 'Massage', zh: '按摩' },
  'компресс': { en: 'Compress', zh: '敷贴' },
  'аппликация': { en: 'Application', zh: '敷用' },
  'распаривание': { en: 'Steaming', zh: '蒸熏' },
  'ополаскивание': { en: 'Rinsing', zh: '冲洗' },
  'нанесение': { en: 'Application', zh: '涂抹' },
  'смывание': { en: 'Washing off', zh: '清洗' },
  'втирание': { en: 'Rubbing in', zh: '揉入' },
  'распределение': { en: 'Distribution', zh: '均匀涂抹' },
  'выдержка': { en: 'Exposure time', zh: '停留时间' },
  'смываемый': { en: 'Rinse-off', zh: '需冲洗' },
  'несмываемый': { en: 'Leave-in', zh: '免洗' },
  'концентрат': { en: 'Concentrate', zh: '浓缩' },
  'активатор': { en: 'Activator', zh: '激活剂' },
  'стабилизатор': { en: 'Stabilizer', zh: '稳定剂' },
  'нейтрализатор': { en: 'Neutralizer', zh: '中和剂' },
  'фиксатор': { en: 'Fixer', zh: '定型剂' },
  'ускоритель': { en: 'Accelerator', zh: '加速剂' },
  'замедлитель': { en: 'Retarder', zh: '缓释剂' },
  'катализатор': { en: 'Catalyst', zh: '催化剂' },
  'праймер': { en: 'Primer', zh: '打底' },
  'база': { en: 'Base', zh: '基底' },
  'топ': { en: 'Top', zh: '表层' },
  'финиш': { en: 'Finish', zh: '定妆' },
  'акрил': { en: 'Acrylic', zh: '亚克力' },
  'гель-лак': { en: 'Gel polish', zh: '甲油胶' },
  'шеллак': { en: 'Shellac', zh: '指甲油' },
  'типсы': { en: 'Tips', zh: '甲片' },
  'форма': { en: 'Form', zh: '甲模' },
  'френч': { en: 'French', zh: '法式' },
  'дизайн ногтей': { en: 'Nail design', zh: '美甲' },
  'наращивание': { en: 'Extension', zh: '嫁接/延长' },
  'коррекция': { en: 'Correction', zh: '修正' },
  'снятие': { en: 'Removal', zh: '卸除' },
  'укрепление ногтей': { en: 'Nail strengthening', zh: '美甲加固' },
}

const findTranslation = (word) => {
  if (FEATURE_TRANSLATIONS[word]) return FEATURE_TRANSLATIONS[word]
  let bestMatch = null
  let bestScore = 0
  for (const key of Object.keys(FEATURE_TRANSLATIONS)) {
    if (word.startsWith(key) && key.length >= 3) {
      if (key.length > bestScore) { bestScore = key.length; bestMatch = FEATURE_TRANSLATIONS[key] }
    } else if (key.startsWith(word) && word.length >= Math.min(key.length * 0.6, 5)) {
      if (word.length > bestScore) { bestScore = word.length; bestMatch = FEATURE_TRANSLATIONS[key] }
    } else if (word.length >= 4 && key.length >= 4) {
      let commonLen = 0
      for (let i = 0; i < Math.min(word.length, key.length); i++) {
        if (word[i] === key[i]) commonLen++
        else break
      }
      if (commonLen >= Math.min(word.length, key.length) * 0.6 && commonLen > bestScore) {
        bestScore = commonLen; bestMatch = FEATURE_TRANSLATIONS[key]
      }
    }
  }
  return bestMatch
}

const inferZhFromMorphology = (word) => {
  const w = word.toLowerCase()
  for (const p of RUSSIAN_PREFIX_MEANINGS) {
    if (w.startsWith(p.prefix) && w.length > p.prefix.length + 2) {
      const rest = w.slice(p.prefix.length)
      const restTrans = findTranslation(rest)
      if (restTrans) return p.zh + restTrans.zh
      const rootTrans = findTranslation(w.slice(p.prefix.length - 1))
      if (rootTrans) return p.zh + rootTrans.zh
      return p.zh + transliterateRu(rest)
    }
  }
  for (const s of RUSSIAN_SUFFIX_MEANINGS) {
    if (w.endsWith(s.suffix) && w.length > s.suffix.length + 2) {
      const root = w.slice(0, w.length - s.suffix.length)
      const rootTrans = findTranslation(root) || findTranslation(root + s.suffix.charAt(0))
      if (rootTrans) return rootTrans.zh + s.zh
    }
  }
  return null
}

const buildDictionary = (products) => {
  const wordStats = {}
  products.forEach(p => {
    const name = p.name || ''
    const words = name.toLowerCase()
      .replace(/[^\wа-яёА-ЯЁ-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !RUSSIAN_STOP_WORDS.has(w) && !/^\d+$/.test(w))
    const uniqueWords = [...new Set(words)]
    uniqueWords.forEach(w => {
      if (!wordStats[w]) wordStats[w] = { count: 0, sales: 0, qty: 0 }
      wordStats[w].count++
      wordStats[w].sales += p.sales
      wordStats[w].qty += p.qty
    })
  })

  const minCount = Math.max(2, Math.floor(products.length * 0.02))
  const dict = {}
  Object.entries(wordStats)
    .filter(([_, d]) => d.count >= minCount)
    .sort((a, b) => b[1].sales - a[1].sales)
    .forEach(([word, d]) => {
      const trans = findTranslation(word)
      const isCyrillic = /[а-яё]/i.test(word)
      const ru = word.charAt(0).toUpperCase() + word.slice(1)
      const morphZh = !trans && isCyrillic ? inferZhFromMorphology(word) : null
      const en = trans ? trans.en : (isCyrillic ? transliterateRu(word) : word)
      const zh = trans ? trans.zh : (morphZh || (isCyrillic ? transliterateRu(word) : word))
      dict[word] = { ru, en, zh, count: d.count, sales: d.sales, qty: d.qty }
    })

  return dict
}

const dictLookup = (dict, word) => {
  const lower = word.toLowerCase()
  if (dict[lower]) return dict[lower]
  for (const key of Object.keys(dict)) {
    if (lower.includes(key) || key.includes(lower)) return dict[key]
  }
  return null
}

const extractFeaturesFromNames = (products, dict, marketAvgPrice) => {
  const groupedFeatures = {}
  Object.entries(dict).forEach(([word, info]) => {
    const trans = findTranslation(word)
    const groupKey = trans ? trans.zh : `__raw_${word}`
    if (!groupedFeatures[groupKey]) {
      groupedFeatures[groupKey] = {
        zh: info.zh, en: info.en, ru: info.ru, keywords: [],
        count: 0, sales: 0, qty: 0, totalPrice: 0, matchedCount: 0, products: []
      }
    }
    groupedFeatures[groupKey].keywords.push(word)
    groupedFeatures[groupKey].count += info.count
    groupedFeatures[groupKey].sales += info.sales
    groupedFeatures[groupKey].qty += info.qty
  })

  products.forEach(p => {
    const lower = (p.name || '').toLowerCase()
    Object.entries(groupedFeatures).forEach(([_, f]) => {
      if (f.keywords.some(k => lower.includes(k))) {
        if (f.products.length < 3) f.products.push(p.name.substring(0, 50))
        if (p.price > 0) {
          f.totalPrice += p.price
          f.matchedCount += 1
        }
      }
    })
  })

  return Object.values(groupedFeatures)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 20)
    .map(f => {
      const featureAvgPrice = f.matchedCount > 0 ? f.totalPrice / f.matchedCount : 0
      const premium = marketAvgPrice > 0 && featureAvgPrice > 0
        ? Math.round((featureAvgPrice / marketAvgPrice - 1) * 100)
        : 0
      return {
        ...f,
        avgPrice: featureAvgPrice,
        premium,
        desc: f.products.slice(0, 2).join('; ')
      }
    })
}

const findColumn = (data, candidates) => {
  if (!data || !data[0]) return null
  const keys = Object.keys(data[0])
  for (const c of candidates) {
    const found = keys.find(k => k.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(k.toLowerCase()))
    if (found) return found
  }
  return null
}

const parseNum = (v) => {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return v
  const s = String(v).replace(/[^\d.kmKМм]/g, '')
  const lower = s.toLowerCase()
  const num = parseFloat(lower.replace(/[kmм]/g, ''))
  if (isNaN(num)) return 0
  if (lower.includes('m') || lower.includes('м')) return num * 1000000
  if (lower.includes('k') || lower.includes('к')) return num * 1000
  return num
}

const getPriceBand = (price, bands) => {
  if (!bands) bands = [[500, '<¥38'], [1000, '¥38-75'], [2000, '¥75-150'], [5000, '¥150-375'], [10000, '¥375-750']]
  for (const [limit, label] of bands) {
    if (price < limit) return label
  }
  return '>¥750'
}

const buildPriceBands = (products) => {
  const prices = products.map(p => p.price).filter(p => p > 0).sort((a, b) => a - b)
  if (prices.length === 0) return null
  const p25 = prices[Math.floor(prices.length * 0.25)]
  const p50 = prices[Math.floor(prices.length * 0.5)]
  const p75 = prices[Math.floor(prices.length * 0.75)]
  const p90 = prices[Math.floor(prices.length * 0.9)]
  const r = R
  return [
    [p25, `<¥${Math.round(p25 * r)}`],
    [p50, `¥${Math.round(p25 * r)}-${Math.round(p50 * r)}`],
    [p75, `¥${Math.round(p50 * r)}-${Math.round(p75 * r)}`],
    [p90, `¥${Math.round(p75 * r)}-${Math.round(p90 * r)}`],
    [Infinity, `>¥${Math.round(p90 * r)}`],
  ]
}

const getSeasonalDataByCategory = (category, avgPrice, priceRange, topKeywords) => {
  const baseMultiplier = priceRange === 'high' ? 1.5 : priceRange === 'mid' ? 1.0 : 0.7
  const keywordStr = topKeywords && topKeywords.length > 0 ? topKeywords.slice(0, 3).join('、') : '该品类'
  const categoryAdjustments = {
    'электрон': { peakMonths: [11, 12, 1], lowMonths: [5, 6, 7], insight: '电子产品', priceMod: 1.3,
      peakText: '黑五/圣诞/新年促销叠加，电子数码产品需求爆发，销量可达淡季2-3倍',
      shoulderText: '春季需求回落但仍稳定，适合电子新品上架测试市场反应',
      lowText: '夏季电子消费低迷，但便携/户外电子设备有小高峰',
      entryText: '建议8月备货入仓，9月启动广告投放，10-11月旺季冲刺销量，抢占黑五市场',
      monthInsights: { 1: '新年消费电子礼品需求延续', 2: '情人节电子礼品促销', 3: '春季新品发布季', 4: '消费电子需求平稳', 5: '夏季前清仓期', 6: '年中大促预热', 7: 'Prime Day竞争期', 8: '返校季电子需求回升', 9: '秋季新品发布潮', 10: '供暖季前小家电需求', 11: '黑五全品类爆发', 12: '圣诞/新年电子礼品高峰' } },
    'бытовой': { peakMonths: [3, 4, 9, 10], lowMonths: [6, 7], insight: '家电用品', priceMod: 0.9,
      peakText: '春秋换季家电需求旺盛，供暖/制冷设备热销，销量可达淡季1.5-2倍',
      shoulderText: '冬季家电需求平稳，适合新品上架积累评价',
      lowText: '夏季家电需求最低，但小家电/厨房电器仍有稳定需求',
      entryText: '建议2月备货入仓，3月启动广告，4月旺季冲刺；8月二次备货，9月秋季冲刺',
      monthInsights: { 1: '冬季供暖设备余温', 2: '春季家电预热', 3: '春季换季家电爆发', 4: '制冷设备需求上升', 5: '小家电稳定需求', 6: '夏季家电淡季', 7: '厨房小家电有需求', 8: '秋季家电预热', 9: '供暖设备需求回升', 10: '供暖设备旺季', 11: '黑五家电促销', 12: '年末家电清仓' } },
    'одежд': { peakMonths: [8, 9, 11, 12], lowMonths: [2, 3], insight: '服装鞋帽', priceMod: 0.85,
      peakText: '秋冬换季+黑五/圣诞，冬装羽绒服需求爆发，销量可达淡季2-3倍',
      shoulderText: '春夏过渡期需求一般，适合春装新品测试',
      lowText: '早春冬装清仓期，夏装尚未起量，整体需求最低',
      entryText: '建议6-7月备货秋冬装，8月启动广告，9月换季冲刺；10月备冬装，11月冲刺',
      monthInsights: { 1: '冬装清仓+新年促销', 2: '冬装深度折扣期', 3: '春装上市测试', 4: '春装需求平稳', 5: '夏装开始上架', 6: '夏装促销期', 7: '夏装清仓+秋装预热', 8: '秋装换季爆发', 9: '秋装旺季+冬装预热', 10: '冬装需求上升', 11: '黑五冬装高峰', 12: '圣诞冬装高峰' } },
    'космет': { peakMonths: [11, 12, 2, 3], lowMonths: [6, 7], insight: '美妆护肤', priceMod: 1.2,
      peakText: '节日送礼+情人节+3.8妇女节，美妆护肤套装热销，销量可达淡季2倍',
      shoulderText: '春季护肤需求稳定，适合新品上架积累口碑',
      lowText: '夏季美妆需求较低，但防晒/控油类产品有小高峰',
      entryText: '建议9月备货节日套装，10月启动广告，11-12月旺季冲刺；1月备货情人节款',
      monthInsights: { 1: '新年护肤需求延续', 2: '情人节美妆礼盒爆发', 3: '3.8妇女节美妆高峰', 4: '春季换季护肤需求', 5: '防晒产品开始热销', 6: '夏季美妆淡季', 7: '控油/清爽类有需求', 8: '秋季护肤预热', 9: '换季护肤需求回升', 10: '保湿/滋润类热销', 11: '黑五美妆套装高峰', 12: '圣诞美妆礼盒高峰' } },
    'волос': { peakMonths: [10, 11, 12, 1, 2, 3], lowMonths: [6, 7], insight: '护发美发', priceMod: 1.1,
      peakText: '秋冬干燥+节日送礼+3.8妇女节，护发/造型产品需求旺盛，销量可达淡季2-2.5倍。俄罗斯冬季室内供暖导致头发干燥受损，深层护理/保湿类产品尤为热销',
      shoulderText: '春季护发需求稳定，染发/造型类产品需求回升，适合新品上架积累评价',
      lowText: '夏季护发需求较低，但防晒/控油/轻薄造型类产品有小高峰，旅行装/迷你装需求增加',
      entryText: '建议8月备货秋冬护发产品（发膜/精油/保湿类），9月启动广告，10月旺季冲刺；1月备货3.8妇女节礼盒装，2月冲刺。夏季可推轻薄/旅行装维持销量',
      monthInsights: { 1: '新年护发礼盒需求延续，深层修复类热销', 2: '情人节护发礼盒+3.8预热', 3: '3.8妇女节护发高峰，染发/造型需求回升', 4: '春季护发需求平稳，轻薄造型类开始热销', 5: '防晒护发/控油类需求上升', 6: '夏季护发淡季，旅行装/迷你装有小高峰', 7: '夏季最低谷，轻薄造型/控油类维持需求', 8: '秋季护发预热，深层护理需求开始回升', 9: '换季护发需求回升，发膜/精油类热销', 10: '供暖季开始，保湿/修复类爆发', 11: '黑五护发套装高峰，高端造型工具热销', 12: '圣诞护发礼盒高峰，全年销量峰值' } },
    'маска': { peakMonths: [10, 11, 12, 1, 2, 3], lowMonths: [6, 7], insight: '发膜/护发膜', priceMod: 1.15,
      peakText: '秋冬干燥+节日送礼+3.8妇女节，发膜/护发膜需求旺盛，深层修复/保湿类尤为热销，销量可达淡季2-2.5倍。俄罗斯冬季室内供暖导致头发严重干燥',
      shoulderText: '春季发膜需求稳定，适合新品上架积累评价，染后修复类需求回升',
      lowText: '夏季发膜需求较低，但轻薄/免洗类发膜有小高峰，旅行装需求增加',
      entryText: '建议8月备货秋冬深层修复发膜，9月启动广告，10月旺季冲刺；1月备货3.8妇女节礼盒装。夏季可推免洗/轻薄发膜维持销量',
      monthInsights: { 1: '新年发膜礼盒需求延续，深层修复类热销', 2: '情人节发膜礼盒+3.8预热', 3: '3.8妇女节发膜高峰', 4: '春季发膜需求平稳', 5: '轻薄/免洗发膜需求上升', 6: '夏季发膜淡季', 7: '夏季最低谷，免洗类维持需求', 8: '秋季发膜预热', 9: '换季发膜需求回升', 10: '供暖季开始，保湿修复发膜爆发', 11: '黑五发膜套装高峰', 12: '圣诞发膜礼盒高峰' } },
    'спрей': { peakMonths: [10, 11, 12, 1, 2, 3], lowMonths: [6, 7], insight: '护发喷雾', priceMod: 1.05,
      peakText: '秋冬干燥+节日送礼，护发喷雾/定型喷雾需求旺盛，热保护/保湿类尤为热销，销量可达淡季2倍。供暖季头发静电/干燥问题突出',
      shoulderText: '春季护发喷雾需求稳定，轻盈定型/UV防护类需求回升',
      lowText: '夏季护发喷雾需求较低，但防晒/控油/海盐喷雾类有小高峰',
      entryText: '建议8月备货秋冬保湿/热保护喷雾，9月启动广告，10月旺季冲刺。夏季可推防晒/控油喷雾维持销量',
      monthInsights: { 1: '新年护发喷雾需求延续，保湿类热销', 2: '情人节喷雾礼盒+3.8预热', 3: '3.8妇女节喷雾高峰', 4: '春季轻盈定型需求回升', 5: 'UV防护/防晒喷雾需求上升', 6: '夏季控油/海盐喷雾小高峰', 7: '夏季最低谷，防晒类维持需求', 8: '秋季护发喷雾预热', 9: '换季保湿喷雾需求回升', 10: '供暖季开始，热保护/保湿喷雾爆发', 11: '黑五喷雾套装高峰', 12: '圣诞喷雾礼盒高峰' } },
    'детск': { peakMonths: [8, 9, 11, 12], lowMonths: [1, 2], insight: '母婴用品', priceMod: 0.95,
      peakText: '开学季+节日送礼，母婴用品需求旺盛，销量可达淡季1.5-2倍',
      shoulderText: '春季需求平稳，适合新品上架测试',
      lowText: '年初需求最低，但春季童装开始预热',
      entryText: '建议6-7月备货开学季产品，8月启动广告；10月备货节日款，11月冲刺',
      monthInsights: { 1: '年初母婴需求最低', 2: '春季童装预热', 3: '春季母婴需求回升', 4: '户外童品需求上升', 5: '夏季童品开始热销', 6: '夏季母婴需求平稳', 7: '暑期母婴促销期', 8: '开学季母婴爆发', 9: '秋季母婴需求旺盛', 10: '秋冬童装需求上升', 11: '黑五母婴高峰', 12: '圣诞母婴高峰' } },
    'продукт': { peakMonths: [11, 12], lowMonths: [7, 8], insight: '食品饮料', priceMod: 0.75,
      peakText: '节日聚餐+新年囤货，食品饮料需求大增，销量可达淡季2倍',
      shoulderText: '春秋需求平稳，适合新品口味测试',
      lowText: '夏季食品需求最低，但冷饮/即食类有小高峰',
      entryText: '建议9月备货节日食品，10月启动广告，11-12月旺季冲刺',
      monthInsights: { 1: '新年食品囤货延续', 2: '春季食品需求平稳', 3: '春季新品测试期', 4: '户外食品需求上升', 5: '冷饮/即食类开始热销', 6: '夏季食品淡季', 7: '冷饮/即食类小高峰', 8: '秋季食品预热', 9: '秋季食品需求回升', 10: '供暖季热饮需求', 11: '黑五食品促销', 12: '圣诞/新年食品高峰' } },
    'спорт': { peakMonths: [3, 4, 9, 10], lowMonths: [1, 12], insight: '运动户外', priceMod: 1.1,
      peakText: '春秋户外运动旺季，健身/跑步/骑行装备热销，销量可达淡季2倍',
      shoulderText: '夏季运动需求平稳，水上运动品类有小高峰',
      lowText: '冬季户外运动需求最低，但室内健身器材仍有需求',
      entryText: '建议1-2月备货春季运动装备，3月启动广告；7-8月备货秋季款，9月冲刺',
      monthInsights: { 1: '冬季运动淡季，室内健身有需求', 2: '春季运动预热', 3: '春季运动爆发', 4: '户外运动旺季', 5: '水上运动开始热销', 6: '夏季运动需求平稳', 7: '水上运动小高峰', 8: '秋季运动预热', 9: '秋季运动爆发', 10: '户外运动旺季尾声', 11: '黑五运动促销', 12: '冬季运动最低谷' } },
    'дом': { peakMonths: [3, 4, 9, 10], lowMonths: [6, 7], insight: '家居用品', priceMod: 0.9,
      peakText: '春秋换季装修/收纳需求旺盛，家居用品销量可达淡季1.5-2倍',
      shoulderText: '冬季需求平稳，适合新品上架积累评价',
      lowText: '夏季家居需求最低，但收纳/清洁类仍有稳定需求',
      entryText: '建议2月备货春季家居，3月启动广告；8月备货秋季款，9月冲刺',
      monthInsights: { 1: '冬季家居需求平稳', 2: '春季家居预热', 3: '春季家居爆发', 4: '换季收纳需求旺盛', 5: '家居需求平稳', 6: '夏季家居淡季', 7: '清洁/收纳类有需求', 8: '秋季家居预热', 9: '秋季家居需求回升', 10: '供暖季家居需求', 11: '黑五家居促销', 12: '年末家居清仓' } },
    'мебел': { peakMonths: [3, 4, 9, 10], lowMonths: [6, 7], insight: '家具', priceMod: 0.9,
      peakText: '春秋换季家具需求旺盛，搬家/装修带动销量，可达淡季1.5-2倍',
      shoulderText: '冬季需求平稳，适合大件家具积累评价',
      lowText: '夏季家具需求最低，但小型/折叠家具仍有需求',
      entryText: '建议2月备货春季家具，3月启动广告；8月备货秋季款，9月冲刺',
      monthInsights: { 1: '冬季家具需求平稳', 2: '春季家具预热', 3: '春季家具爆发', 4: '搬家季家具需求旺盛', 5: '家具需求平稳', 6: '夏季家具淡季', 7: '小型家具有需求', 8: '秋季家具预热', 9: '秋季家具需求回升', 10: '供暖季家具需求', 11: '黑五家具促销', 12: '年末家具清仓' } },
    'авто': { peakMonths: [4, 5, 9, 10], lowMonths: [1, 2], insight: '汽车用品', priceMod: 1.0,
      peakText: '春秋自驾出行旺季，汽车配件/养护需求旺盛，销量可达淡季1.5-2倍',
      shoulderText: '夏季自驾出行需求平稳，车载电子/清洁类热销',
      lowText: '冬季汽车用品需求最低，但防滑/加热类有小高峰',
      entryText: '建议3月备货春季汽车用品，4月启动广告；8月备货秋季款，9月冲刺',
      monthInsights: { 1: '冬季汽车用品最低谷', 2: '防滑/加热类有需求', 3: '春季汽车用品预热', 4: '春季自驾出行爆发', 5: '自驾出行旺季', 6: '车载电子/清洁类热销', 7: '夏季自驾需求平稳', 8: '秋季汽车用品预热', 9: '秋季自驾出行爆发', 10: '自驾出行旺季尾声', 11: '黑五汽车用品促销', 12: '冬季汽车用品需求低' } },
    'игруш': { peakMonths: [11, 12], lowMonths: [6, 7], insight: '玩具', priceMod: 1.1,
      peakText: '圣诞/新年送礼季，玩具需求爆发，销量可达淡季3-4倍',
      shoulderText: '春秋需求平稳，适合新品上架积累评价',
      lowText: '夏季玩具需求最低，但户外/水上游玩类有小高峰',
      entryText: '建议8-9月备货节日玩具，10月启动广告，11-12月旺季冲刺',
      monthInsights: { 1: '新年玩具需求延续', 2: '玩具需求回落', 3: '春季玩具新品测试', 4: '户外玩具需求上升', 5: '户外玩具热销', 6: '夏季玩具淡季', 7: '水上玩具有小高峰', 8: '秋季玩具预热', 9: '玩具需求回升', 10: '节日玩具预热', 11: '黑五玩具高峰', 12: '圣诞玩具全年峰值' } },
    'сад': { peakMonths: [4, 5, 9, 10], lowMonths: [1, 2, 12], insight: '园艺', priceMod: 0.85,
      peakText: '春秋园艺旺季，种植/养护工具需求旺盛，销量可达淡季2倍',
      shoulderText: '夏季园艺需求平稳，灌溉/遮阳类热销',
      lowText: '冬季园艺需求最低，但室内植物/温室用品有小高峰',
      entryText: '建议3月备货春季园艺，4月启动广告；8月备货秋季款，9月冲刺',
      monthInsights: { 1: '冬季园艺最低谷', 2: '室内植物有需求', 3: '春季园艺预热', 4: '春季园艺爆发', 5: '种植工具需求旺盛', 6: '灌溉/遮阳类热销', 7: '夏季园艺需求平稳', 8: '秋季园艺预热', 9: '秋季园艺爆发', 10: '养护工具需求旺盛', 11: '黑五园艺促销', 12: '冬季园艺最低谷' } },
    'строит': { peakMonths: [4, 5, 9, 10], lowMonths: [1, 2], insight: '建材', priceMod: 0.95,
      peakText: '春秋装修旺季，建材需求旺盛，销量可达淡季1.5-2倍',
      shoulderText: '夏季施工需求平稳，适合新品上架',
      lowText: '冬季建材需求最低，但室内装修/保温类仍有需求',
      entryText: '建议3月备货春季建材，4月启动广告；8月备货秋季款，9月冲刺',
      monthInsights: { 1: '冬季建材最低谷', 2: '室内装修有需求', 3: '春季建材预热', 4: '春季建材爆发', 5: '装修旺季延续', 6: '建材需求平稳', 7: '建材需求平稳', 8: '秋季建材预热', 9: '秋季建材爆发', 10: '装修旺季延续', 11: '黑五建材促销', 12: '冬季建材需求低' } },
    'книг': { peakMonths: [8, 9, 11, 12], lowMonths: [6, 7], insight: '图书文具', priceMod: 0.8,
      peakText: '开学季+节日送礼，图书文具需求旺盛，销量可达淡季2倍',
      shoulderText: '春秋需求平稳，适合新品上架',
      lowText: '夏季图书文具需求最低，但旅行阅读/手账类有小高峰',
      entryText: '建议6-7月备货开学季产品，8月启动广告；10月备货节日款，11月冲刺',
      monthInsights: { 1: '新年文具需求延续', 2: '文具需求回落', 3: '春季文具需求平稳', 4: '文具需求平稳', 5: '旅行阅读类有需求', 6: '夏季图书文具淡季', 7: '手账类有小高峰', 8: '开学季文具爆发', 9: '开学季延续', 10: '文具需求平稳', 11: '黑五图书促销', 12: '圣诞图书高峰' } },
    'зоо': { peakMonths: [11, 12], lowMonths: [6, 7], insight: '宠物用品', priceMod: 1.0,
      peakText: '节日送礼+冬季宠物保暖需求，宠物用品销量可达淡季1.5倍',
      shoulderText: '春秋需求平稳，适合新品上架',
      lowText: '夏季宠物用品需求较低，但户外/旅行宠物用品有小高峰',
      entryText: '建议9月备货节日宠物用品，10月启动广告，11-12月旺季冲刺',
      monthInsights: { 1: '冬季宠物保暖需求', 2: '宠物用品需求平稳', 3: '春季宠物用品回升', 4: '户外宠物用品需求', 5: '户外宠物用品热销', 6: '夏季宠物用品淡季', 7: '旅行宠物用具有需求', 8: '秋季宠物用品预热', 9: '宠物用品需求回升', 10: '保暖宠物用品需求', 11: '黑五宠物用品高峰', 12: '圣诞宠物用品高峰' } },
    'электр': { peakMonths: [11, 12, 1], lowMonths: [5, 6, 7], insight: '电子产品', priceMod: 1.3,
      peakText: '黑五/圣诞/新年促销叠加，电子数码产品需求爆发，销量可达淡季2-3倍',
      shoulderText: '春季需求回落但仍稳定，适合电子新品上架测试市场反应',
      lowText: '夏季电子消费低迷，但便携/户外电子设备有小高峰',
      entryText: '建议8月备货入仓，9月启动广告投放，10-11月旺季冲刺销量，抢占黑五市场',
      monthInsights: { 1: '新年消费电子礼品需求延续', 2: '情人节电子礼品促销', 3: '春季新品发布季', 4: '消费电子需求平稳', 5: '夏季前清仓期', 6: '年中大促预热', 7: 'Prime Day竞争期', 8: '返校季电子需求回升', 9: '秋季新品发布潮', 10: '供暖季前小家电需求', 11: '黑五全品类爆发', 12: '圣诞/新年电子礼品高峰' } },
    'товар': { peakMonths: [11, 12], lowMonths: [6, 7], insight: '日用品', priceMod: 0.9,
      peakText: '节日囤货+新年采购，日用品需求旺盛，销量可达淡季1.5倍',
      shoulderText: '春秋需求平稳，适合新品上架测试',
      lowText: '夏季日用品需求较低，但户外/旅行用品种类有小高峰',
      entryText: '建议9月备货节日日用品，10月启动广告，11-12月旺季冲刺',
      monthInsights: { 1: '新年日用品囤货延续', 2: '日用品需求回落', 3: '春季日用品需求平稳', 4: '清洁/收纳类需求', 5: '户外日用品需求', 6: '夏季日用品淡季', 7: '旅行用具有小高峰', 8: '秋季日用品预热', 9: '日用品需求回升', 10: '供暖季日用品需求', 11: '黑五日用品促销', 12: '圣诞日用品高峰' } },
    'укладк': { peakMonths: [10, 11, 12, 1, 2, 3], lowMonths: [6, 7], insight: '造型工具', priceMod: 1.15,
      peakText: '秋冬派对季+节日送礼+3.8妇女节，造型工具（吹风机/卷发棒/直发器）需求旺盛，销量可达淡季2-2.5倍',
      shoulderText: '春季造型需求稳定，轻便/旅行款需求回升',
      lowText: '夏季造型工具需求较低，但便携/迷你款有小高峰',
      entryText: '建议8月备货秋冬造型工具，9月启动广告，10月旺季冲刺；1月备货3.8妇女节款',
      monthInsights: { 1: '新年造型工具需求延续', 2: '情人节造型工具礼盒+3.8预热', 3: '3.8妇女节造型工具高峰', 4: '春季造型需求平稳', 5: '便携/旅行款需求上升', 6: '夏季造型工具淡季', 7: '迷你/便携款维持需求', 8: '秋季造型工具预热', 9: '换季造型需求回升', 10: '派对季造型工具爆发', 11: '黑五造型工具高峰', 12: '圣诞造型工具高峰' } },
    'default': { peakMonths: [11, 12], lowMonths: [6, 7], insight: '综合品类', priceMod: 1.0,
      peakText: '黑五/圣诞/新年促销叠加，销量可达淡季2-3倍',
      shoulderText: '需求回落但仍稳定，适合新品上架测试市场反应',
      lowText: '夏季需求最低，但细分品类仍有小高峰',
      entryText: '建议旺季前2个月备货入仓，旺季前1个月启动广告，旺季首月冲刺销量',
      monthInsights: null }
  }
  
  const catLower = category.toLowerCase()
  const categoryAliasMap = [
    ['发膜', 'маска'], ['护发膜', 'маска'], ['护发喷雾', 'спрей'],
    ['喷雾', 'спрей'], ['吹风机', 'укладк'], ['卷发', 'укладк'],
    ['直发', 'укладк'], ['造型', 'укладк'], ['护发产品', 'волос'],
    ['护发', 'волос'], ['美发', 'волос'], ['美妆', 'космет'],
    ['护肤', 'космет'], ['美容', 'космет'], ['卫生', 'космет'],
    ['电子', 'электрон'], ['数码', 'электрон'], ['家电', 'бытовой'],
    ['服装', 'одежд'], ['鞋帽', 'одежд'], ['母婴', 'детск'],
    ['食品', 'продукт'], ['饮料', 'продукт'], ['运动', 'спорт'],
    ['户外', 'спорт'], ['家居', 'дом'], ['家具', 'мебел'],
    ['汽车', 'авто'], ['玩具', 'игруш'], ['园艺', 'сад'],
    ['建材', 'строит'], ['图书', 'книг'], ['文具', 'книг'],
    ['宠物', 'зоо'], ['日用', 'товар'],
  ]
  let catKey = Object.keys(categoryAdjustments).find(k => catLower.includes(k))
  if (!catKey) {
    for (const [alias, key] of categoryAliasMap) {
      if (catLower.includes(alias)) { catKey = key; break }
    }
  }
  if (!catKey) catKey = 'default'
  const adj = categoryAdjustments[catKey]
  
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const peakSet = new Set(adj.peakMonths)
  const lowSet = new Set(adj.lowMonths)
  
  const monthlyData = months.map(m => {
    let salesIndex, searchIndex, avgPriceVal
    const basePrice = avgPrice > 0 ? avgPrice : 220
    
    if (peakSet.has(m)) {
      salesIndex = Math.round((120 + 15 * (12 - m) / 11) * baseMultiplier * adj.priceMod)
      searchIndex = Math.round((110 + 12 * (12 - m) / 11) * baseMultiplier * adj.priceMod)
      avgPriceVal = Math.round(basePrice * (1 + 0.08 * (m === 11 || m === 12 ? 1 : 0)))
    } else if (lowSet.has(m)) {
      salesIndex = Math.round((55 + 8 * m / 12) * baseMultiplier * adj.priceMod)
      searchIndex = Math.round((50 + 6 * m / 12) * baseMultiplier * adj.priceMod)
      avgPriceVal = Math.round(basePrice * 0.95)
    } else {
      salesIndex = Math.round((80 + 10 * m / 12) * baseMultiplier * adj.priceMod)
      searchIndex = Math.round((75 + 8 * m / 12) * baseMultiplier * adj.priceMod)
      avgPriceVal = Math.round(basePrice)
    }
    
    let insight = ''
    if (adj.monthInsights && adj.monthInsights[m]) {
      insight = adj.monthInsights[m]
    } else {
      if (m === 1) insight = `新年开局，${keywordStr}礼品需求上升`
      else if (m === 2) insight = `情人节促销，${keywordStr}礼物类热销`
      else if (m === 3) insight = `春季换季，${adj.insight}需求回升`
      else if (m === 4) insight = `春季消费季，${keywordStr}需求增加`
      else if (m === 5) insight = `春夏之交，${adj.insight}需求平稳`
      else if (m === 6) insight = `夏季淡季，${keywordStr}促销活动减少`
      else if (m === 7) insight = `暑期低谷，${adj.insight}需求下降`
      else if (m === 8) insight = `开学季预热，${keywordStr}需求回升`
      else if (m === 9) insight = `秋季回暖，${adj.insight}需求回暖`
      else if (m === 10) insight = `供暖季前夕，${keywordStr}需求上升`
      else if (m === 11) insight = `黑五大促，${adj.insight}全年峰值`
      else if (m === 12) insight = `年末节日，${keywordStr}销售旺季`
    }
    
    return {
      month: `${m}月`,
      salesIndex,
      searchIndex,
      avgPrice: avgPriceVal,
      insight
    }
  })

  const peakLabel = adj.peakMonths.sort((a, b) => a - b).map(m => `${m}月`).join('/')
  const lowLabel = adj.lowMonths.sort((a, b) => a - b).map(m => `${m}月`).join('/')
  const shoulderMonths = months.filter(m => !peakSet.has(m) && !lowSet.has(m)).sort((a, b) => a - b)
  const shoulderLabel = shoulderMonths.map(m => `${m}月`).join('/')

  const seasonalAdvice = {
    peak: { months: peakLabel, text: adj.peakText || `${adj.insight}旺季，黑五/圣诞/新年促销叠加，销量可达淡季2-3倍` },
    shoulder: { months: shoulderLabel, text: adj.shoulderText || `需求回落但仍稳定，适合${keywordStr}新品上架测试市场反应` },
    low: { months: lowLabel, text: adj.lowText || `需求最低，但${keywordStr}细分品类仍有小高峰` },
    entry: adj.entryText || `建议旺季前2个月备货入仓，旺季前1个月启动广告，旺季首月冲刺销量`
  }

  return { monthlyData, seasonalAdvice }
}

export default function NewDashboard({ data, kpis }) {
  const [showAllSizes, setShowAllSizes] = useState(false)
  const [showAllMaterials, setShowAllMaterials] = useState(false)
  const [sprayExporting, setSprayExporting] = useState(false)
  const sprayStockRef = useRef(null)
  const stats = useMemo(() => {
    if (!data || data.length === 0) return null

    const salesCol = findColumn(data, ['销售额'])
    const qtyCol = findColumn(data, ['销量'])
    const priceCol = findColumn(data, ['平均单价', '价格'])
    const brandCol = findColumn(data, ['品牌'])
    const ratingCol = findColumn(data, ['评分'])
    const shippingCol = findColumn(data, ['发货模式', 'FBO', 'FBS', 'тип_доставки', 'доставка', 'fulfillment', 'Тип доставки', 'FBO FBS'])
    const dateCol = findColumn(data, ['商品卡创建日期', '创建日期'])
    const adCostCol = findColumn(data, ['广告费用'])
    const exposureCol = findColumn(data, ['曝光量'])
    const clickCol = findColumn(data, ['点击率', '浏览次数'])
    const convertCol = findColumn(data, ['转化指数', '订单转化率'])
    const grossCol = findColumn(data, ['预估毛利率'])
    const cartCol = findColumn(data, ['购物车率'])
    const nameCol = findColumn(data, ['商品名称', '产品名称'])
    const potentialCol = findColumn(data, ['潜力指数'])
    const adRatioCol = findColumn(data, ['广告占比'])
    const promoPriceCol = findColumn(data, ['促销前的价格', '促销前价格'])
    const discountCol = findColumn(data, ['促销活动折扣', '折扣'])
    const promoDaysCol = findColumn(data, ['促销活动天数占比', '活动天数占比'])
    const promoDaysCountCol = findColumn(data, ['促销活动天数', '活动天数'])
    const adDaysCol = findColumn(data, ['推广天数占比', '广告天数占比'])
    const adDaysCountCol = findColumn(data, ['推广天数', '广告天数'])
    const categoryCol = findColumn(data, ['类目', '品类', '分类', 'category', 'категория', 'категор'])

    const getProductZhTags = (name, dict) => {
      if (!name) return []
      const lower = name.toLowerCase()
      const tags = []
      Object.entries(dict).forEach(([word, info]) => {
        if (lower.includes(word) && info.zh) tags.push(info.zh)
      })
      const unique = [...new Set(tags)]
      return unique.slice(0, 3)
    }

    const products = data.map(item => {
      const name = item[nameCol] || String(Object.values(item)[1] || '')
      return {
        sales: parseNum(item[salesCol]),
        qty: parseNum(item[qtyCol]),
        price: parseNum(item[priceCol]),
        gross: item[grossCol] != null && item[grossCol] !== '' ? parseNum(item[grossCol]) : null,
        exposure: parseNum(item[exposureCol]),
        clicks: parseNum(item[clickCol]),
        adCost: parseNum(item[adCostCol]),
        cartRate: parseNum(item[cartCol]),
        convert: parseNum(item[convertCol]),
        potential: parseNum(item[potentialCol]),
        adRatio: parseNum(item[adRatioCol]),
        promoPrice: parseNum(item[promoPriceCol]),
        discount: parseNum(item[discountCol]),
        promoDaysRatio: parseNum(item[promoDaysCol]),
        promoDaysCount: parseNum(item[promoDaysCountCol]),
        adDaysRatio: parseNum(item[adDaysCol]),
        adDaysCount: parseNum(item[adDaysCountCol]),
        name,
        brand: item[brandCol] || '未知',
        shipping: (() => {
          const rawShipping = String(item[shippingCol] || '').trim()
          const isValidMode = /^(fbo|fbs|fbofbs|rfbs|ozon|fborfbs)$/i.test(rawShipping)
          if (isValidMode) {
            const lower = rawShipping.toLowerCase()
            if (lower === 'fbofbs') return 'FBO+FBS'
            if (lower === 'rfbs') return 'rFBS'
            if (lower === 'fborfbs') return 'FBO+rFBS'
            return rawShipping.toUpperCase()
          }
          const rawName = name || ''
          const combined = (rawShipping + ' ' + rawName).toLowerCase()
          if (combined.includes('fbo') && combined.includes('fbs')) return 'FBO+FBS'
          if (combined.includes('rfbs')) return 'rFBS'
          if (combined.includes('fbs')) return 'FBS'
          if (combined.includes('fbo')) return 'FBO'
          if (combined.includes('ozon')) return 'OZON'
          return '未知'
        })(),
        rating: parseNum(item[ratingCol]),
        date: item[dateCol] || '',
        category: item[categoryCol] || '未分类'
      }
    })

    const dictionary = buildDictionary(products)
    const marketAvgPrice = products.filter(p => p.price > 0).length > 0
      ? products.filter(p => p.price > 0).reduce((s, p) => s + p.price, 0) / products.filter(p => p.price > 0).length
      : 0
    const extractedFeatures = extractFeaturesFromNames(products, dictionary, marketAvgPrice)
    products.forEach(p => { p.zhTags = getProductZhTags(p.name, dictionary) })

    const totalSales = products.reduce((s, p) => s + p.sales, 0)
    const totalQty = products.reduce((s, p) => s + p.qty, 0)
    const totalExposure = products.reduce((s, p) => s + p.exposure, 0)
    const totalClicks = products.reduce((s, p) => s + p.clicks, 0)
    const totalAdCost = products.reduce((s, p) => s + p.adCost, 0)
    const grossProducts = products.filter(p => p.gross != null && p.gross > 0)
    const avgGross = grossProducts.length > 0 ? grossProducts.reduce((s, p) => s + p.gross, 0) / grossProducts.length : null
    const avgCartRate = products.reduce((s, p) => s + p.cartRate, 0) / products.length
    const avgPrice = products.filter(p => p.price > 0 && p.qty > 0).length > 0
      ? products.filter(p => p.price > 0 && p.qty > 0).reduce((s, p) => s + p.price * p.qty, 0) / products.filter(p => p.price > 0 && p.qty > 0).reduce((s, p) => s + p.qty, 0)
      : products.filter(p => p.price > 0).length > 0
        ? products.filter(p => p.price > 0).reduce((s, p) => s + p.price, 0) / products.filter(p => p.price > 0).length
        : 0

    const categoryStats = {}
    products.forEach(p => {
      if (!categoryStats[p.category]) categoryStats[p.category] = { count: 0, qty: 0, sales: 0 }
      categoryStats[p.category].count += 1
      categoryStats[p.category].qty += p.qty
      categoryStats[p.category].sales += p.sales
    })
    const topCategory = Object.entries(categoryStats).sort((a, b) => b[1].sales - a[1].sales)[0]

    const brandStats = {}
    products.forEach(p => {
      if (!brandStats[p.brand]) brandStats[p.brand] = { sales: 0, qty: 0, count: 0, adCost: 0 }
      brandStats[p.brand].sales += p.sales
      brandStats[p.brand].qty += p.qty
      brandStats[p.brand].count += 1
      brandStats[p.brand].adCost += p.adCost
    })
    const topBrands = Object.entries(brandStats)
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 10)
      .map(([name, d]) => ({ name, ...d, share: (d.sales / totalSales * 100).toFixed(1) }))

    const shippingStats = {}
    products.forEach(p => {
      const mode = p.shipping || '未知'
      if (!shippingStats[mode]) shippingStats[mode] = { count: 0, sales: 0, qty: 0 }
      shippingStats[mode].count += 1
      shippingStats[mode].sales += p.sales
      shippingStats[mode].qty += p.qty
    })
    const shippingData = Object.entries(shippingStats).map(([name, d]) => ({
      name: name.includes('FBO') && name.includes('FBS') ? 'FBO+FBS' : name.includes('FBO') ? 'FBO仓配' : name.includes('FBS') ? 'FBS自发' : name,
      count: d.count, sales: d.sales, qty: d.qty
    })).filter(d => d.count > 0)

    const fbsFboCompare = [
      { name: 'FBO仓配', qty: 0, sales: 0, count: 0, avgPrice: 0 },
      { name: 'FBS自发', qty: 0, sales: 0, count: 0, avgPrice: 0 },
      { name: 'FBO+FBS', qty: 0, sales: 0, count: 0, avgPrice: 0 },
    ]
    products.forEach(p => {
      const mode = String(p.shipping || '')
      if (mode.includes('FBO') && mode.includes('FBS')) {
        fbsFboCompare[2].qty += p.qty; fbsFboCompare[2].sales += p.sales; fbsFboCompare[2].count += 1
      } else if (mode.includes('FBO')) {
        fbsFboCompare[0].qty += p.qty; fbsFboCompare[0].sales += p.sales; fbsFboCompare[0].count += 1
      } else if (mode.includes('FBS')) {
        fbsFboCompare[1].qty += p.qty; fbsFboCompare[1].sales += p.sales; fbsFboCompare[1].count += 1
      }
    })
    fbsFboCompare.forEach(f => { f.avgPrice = f.qty > 0 ? f.sales / f.qty : 0 })
    const fbsFboChartData = fbsFboCompare.filter(f => f.count > 0)

    const priceBands = buildPriceBands(products)
    const priceRange = {}
    products.forEach(p => {
      const range = getPriceBand(p.price, priceBands)
      if (!priceRange[range]) priceRange[range] = { count: 0, sales: 0, qty: 0, adCost: 0 }
      priceRange[range].count += 1
      priceRange[range].sales += p.sales
      priceRange[range].qty += p.qty
      priceRange[range].adCost += p.adCost
    })
    const priceData = Object.entries(priceRange).map(([name, d]) => ({
      name, count: d.count, sales: d.sales, qty: d.qty, adCost: d.adCost,
      avgAdCost: d.count > 0 ? d.adCost / d.count : 0,
      avgAdRatio: d.sales > 0 ? (d.adCost / d.sales * 100) : 0,
      avgPrice: d.qty > 0 ? d.sales / d.qty : 0
    }))

    const featureData = extractedFeatures

    const priceBandFeatures = {}
    products.forEach(p => {
      const band = getPriceBand(p.price, priceBands)
      if (!priceBandFeatures[band]) priceBandFeatures[band] = {}
      const lower = p.name.toLowerCase()
      Object.entries(dictionary).forEach(([word, info]) => {
        if (lower.includes(word)) {
          if (!priceBandFeatures[band][info.zh]) priceBandFeatures[band][info.zh] = { count: 0, sales: 0, qty: 0, ru: info.ru, en: info.en }
          priceBandFeatures[band][info.zh].count++
          priceBandFeatures[band][info.zh].sales += p.sales
          priceBandFeatures[band][info.zh].qty += p.qty
        }
      })
    })
    const priceBandFeatureData = Object.entries(priceBandFeatures).map(([band, features]) => {
      const bandProducts = products.filter(p => getPriceBand(p.price, priceBands) === band)
      const topFeatures = Object.entries(features)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, d]) => ({ name, ru: d.ru, en: d.en, count: d.count, sales: d.sales, avgPrice: d.qty > 0 ? d.sales / d.qty : 0, penetration: (d.count / bandProducts.length * 100).toFixed(1) }))
      return { band, productCount: bandProducts.length, totalSales: bandProducts.reduce((s, p) => s + p.sales, 0), avgPrice: bandProducts.filter(p => p.qty > 0).reduce((s, p) => s + p.price * p.qty, 0) / bandProducts.filter(p => p.qty > 0).reduce((s, p) => s + p.qty, 0) || 0, features: topFeatures }
    })

    const topProducts = [...products].sort((a, b) => b.qty - a.qty).slice(0, 15)
    const fbsTopProducts = products.filter(p => p.shipping && String(p.shipping).includes('FBS')).sort((a, b) => b.qty - a.qty).slice(0, 15)
    const highPotential = [...products].sort((a, b) => (b.potential || b.qty) - (a.potential || a.qty)).slice(0, 10).map(p => {
      let reason = ''
      if (p.potential > 80) reason = '潜力指数极高'
      else if (p.potential > 60) reason = '潜力指数优秀'
      else if (p.potential > 40) reason = '潜力指数良好'
      else if (p.qty > totalQty / products.length * 2) reason = '销量远超平均'
      else if (p.qty > totalQty / products.length) reason = '销量高于平均'
      else reason = '综合表现良好'
      return { ...p, selectReason: reason }
    })
    
    const vacuumZone = products.filter(p => p.price > avgPrice && p.qty > totalQty / products.length).slice(0, 10).map(p => {
      const priceLevel = p.price > avgPrice * 1.5 ? '超高价格' : p.price > avgPrice * 1.2 ? '高价格' : '高于平均'
      const salesLevel = p.qty > totalQty / products.length * 3 ? '热销' : p.qty > totalQty / products.length * 2 ? '畅销' : '良好销量'
      return { ...p, selectReason: `${priceLevel} + ${salesLevel}` }
    })

    const now = new Date()
    const days180 = 180 * 24 * 60 * 60 * 1000
    const newProducts180 = products.filter(p => {
      if (!p.date) return false
      const d = new Date(p.date)
      if (isNaN(d.getTime())) return false
      return (now - d) <= days180
    }).sort((a, b) => b.qty - a.qty).slice(0, 15)
    const newProductsStats = newProducts180.length > 0 ? {
      count: newProducts180.length,
      totalQty: newProducts180.reduce((s, p) => s + p.qty, 0),
      totalSales: newProducts180.reduce((s, p) => s + p.sales, 0),
      avgPrice: newProducts180.reduce((s, p) => s + p.price, 0) / newProducts180.length,
      topBrands: [...new Set(newProducts180.map(p => p.brand))].slice(0, 5),
      priceBandDist: (() => {
        const bands = {}
        newProducts180.forEach(p => {
          const band = getPriceBand(p.price, priceBands)
          bands[band] = (bands[band] || 0) + 1
        })
        return Object.entries(bands).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
      })(),
    } : null
    // 有广告投入的产品ROI计算
    const adEfficiency = products.filter(p => p.adRatio > 0 && p.sales >= 10000).map(p => {
      const adCostCalc = p.sales * (p.adRatio / 100)
      const adRoi = adCostCalc > 0 ? ((p.sales - adCostCalc) / adCostCalc) : 0
      const salesMultiple = adCostCalc > 0 ? (p.sales / adCostCalc) : 0
      return { ...p, adCostCalc, roi: adRoi, salesMultiple }
    }).sort((a, b) => b.roi - a.roi).slice(0, 10)
    
    // 无广告投入但高销量的产品
    const noAdHighSales = products.filter(p => p.adRatio === 0 && p.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 10)
    
    // 运营策略分析（促销、活动、推广数据）
    const operationStrategy = (() => {
      const withPromo = products.filter(p => p.discount > 0 || p.promoDaysRatio > 0)
      const withAd = products.filter(p => p.adDaysRatio > 0 || p.adRatio > 0)
      const highPromo = products.filter(p => p.discount >= 20)
      const longPromo = products.filter(p => p.promoDaysRatio >= 30)
      const highAd = products.filter(p => p.adDaysRatio >= 50)
      
      // 促销效果分析
      const promoEffect = withPromo.length > 0 ? {
        avgDiscount: withPromo.reduce((s, p) => s + p.discount, 0) / withPromo.length,
        avgPromoDays: withPromo.reduce((s, p) => s + p.promoDaysRatio, 0) / withPromo.length,
        avgSales: withPromo.reduce((s, p) => s + p.qty, 0) / withPromo.length,
        avgPriceDrop: withPromo.filter(p => p.promoPrice > 0).reduce((s, p) => s + (p.promoPrice - p.price) / p.promoPrice * 100, 0) / withPromo.filter(p => p.promoPrice > 0).length || 0
      } : null
      
      // 推广效果分析
      const adEffect = withAd.length > 0 ? {
        avgAdDays: withAd.reduce((s, p) => s + p.adDaysRatio, 0) / withAd.length,
        avgSales: withAd.reduce((s, p) => s + p.qty, 0) / withAd.length,
        avgAdCost: withAd.reduce((s, p) => s + p.adCost, 0) / withAd.length
      } : null
      
      // 最佳实践产品
      const bestPractice = products
        .filter(p => p.qty > totalQty / products.length)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5)
        .map(p => ({
          name: p.name.slice(0, 20),
          qty: p.qty,
          discount: p.discount,
          promoDays: p.promoDaysRatio,
          adDays: p.adDaysRatio,
          strategy: p.discount > 20 ? '高折扣促销' : p.promoDaysRatio > 30 ? '长期促销' : p.adDaysRatio > 50 ? '持续推广' : p.adRatio > 0 ? '精准投放' : '自然流量'
        }))
      
      return {
        promoStats: { count: withPromo.length, highDiscount: highPromo.length, longDuration: longPromo.length },
        adStats: { count: withAd.length, highDuration: highAd.length },
        promoEffect,
        adEffect,
        bestPractice,
        insight: withPromo.length > products.length * 0.5 ? '市场促销竞争激烈，建议差异化促销策略' : withAd.length > products.length * 0.5 ? '广告投放普遍，需优化投放效率' : '市场以自然流量为主，有广告红利机会'
      }
    })()
    
    const priceElasticity = products.filter(p => p.price > 0 && p.qty > 0).map(p => ({ price: p.price, qty: p.qty, name: p.name.slice(0, 20), brand: p.brand, sales: p.sales }))

    const priceScatterAnalysis = (() => {
      const sortedByPrice = [...products].sort((a, b) => a.price - b.price)
      const lowPrice = sortedByPrice.slice(0, Math.ceil(products.length * 0.3))
      const midPrice = sortedByPrice.slice(Math.ceil(products.length * 0.3), Math.ceil(products.length * 0.7))
      const highPrice = sortedByPrice.slice(Math.ceil(products.length * 0.7))
      
      const lowPriceAvg = lowPrice.reduce((s, p) => s + p.qty, 0) / lowPrice.length
      const midPriceAvg = midPrice.reduce((s, p) => s + p.qty, 0) / midPrice.length
      const highPriceAvg = highPrice.reduce((s, p) => s + p.qty, 0) / highPrice.length
      
      const highSalesLowComp = products.filter(p => {
        const similarPrice = products.filter(op => Math.abs(op.price - p.price) / p.price < 0.2)
        return p.qty > totalQty / products.length && similarPrice.length < 5
      }).slice(0, 5)
      
      const priceCorrelation = (() => {
        const n = products.length
        const sumX = products.reduce((s, p) => s + p.price, 0)
        const sumY = products.reduce((s, p) => s + p.qty, 0)
        const sumXY = products.reduce((s, p) => s + p.price * p.qty, 0)
        const sumX2 = products.reduce((s, p) => s + p.price * p.price, 0)
        const sumY2 = products.reduce((s, p) => s + p.qty * p.qty, 0)
        const correlation = (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
        return isNaN(correlation) ? 0 : correlation
      })()
      
      return {
        lowPrice: { count: lowPrice.length, avgQty: lowPriceAvg, avgPrice: lowPrice.reduce((s, p) => s + p.price, 0) / lowPrice.length },
        midPrice: { count: midPrice.length, avgQty: midPriceAvg, avgPrice: midPrice.reduce((s, p) => s + p.price, 0) / midPrice.length },
        highPrice: { count: highPrice.length, avgQty: highPriceAvg, avgPrice: highPrice.reduce((s, p) => s + p.price, 0) / highPrice.length },
        highSalesLowComp,
        priceCorrelation,
        insight: priceCorrelation < -0.3 ? '价格敏感型市场，低价产品销量优势明显' : priceCorrelation > 0.3 ? '品质导向市场，高价产品也能获得高销量' : '价格与销量关联度不高，差异化竞争空间大'
      }
    })()

    const underservedPrices = []
    ;[500, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 7000, 10000].forEach(step => {
      const inRange = products.filter(p => p.price >= step - 300 && p.price < step + 300)
      const avgSales = inRange.reduce((s, p) => s + p.qty, 0) / (inRange.length || 1)
      if (inRange.length < 5 && avgSales > 20) underservedPrices.push({ price: step, count: inRange.length, avgSales })
    })

    const hhi = Object.values(brandStats).reduce((s, b) => { const share = (b.sales / totalSales) * 100; return s + share * share }, 0)
    const marketPower = hhi > 2500 ? '高度集中' : hhi > 1500 ? '中度集中' : '竞争型'
    const brandPower = topBrands.map((b, i) => ({ ...b, powerLevel: i === 0 ? '绝对龙头' : i < 3 ? '强势品牌' : i < 6 ? '主流品牌' : '中小品牌', barrierLevel: i < 3 ? '高壁垒' : i < 6 ? '中壁垒' : '低壁垒' }))
    const marketConcentration = topBrands.slice(0, 3).reduce((s, b) => s + parseFloat(b.share), 0)
    const topCatName = topCategory ? topCategory[0] : '未分类'
    const priceLevel = avgPrice * R > 300 ? 'high' : avgPrice * R > 150 ? 'mid' : 'low'
    const topKeywords = extractedFeatures.slice(0, 5).map(f => f.zh)
    const { monthlyData: seasonalData, seasonalAdvice } = getSeasonalDataByCategory(topCatName, Math.round(avgPrice * R), priceLevel, topKeywords)

    const isPillowCategory = /枕|подушк|pillow/i.test(topCatName)
    const sizeMaterialData = (() => {
      if (!isPillowCategory) return null
      const sizeRegex = /(\d{2,3})\s*[хx×]\s*(\d{2,3})(?:\s*[хx×]\s*(\d{2,3}))?/i
      const sizeCmRegex = /(\d{2,3})\s*[хx×]\s*(\d{2,3})\s*см/i
      const SIZE_GROUPS = [
        { label: '60×40', aliases: [[38,58],[39,59],[40,60],[41,61],[42,62],[58,38],[59,39],[60,40],[61,41],[62,42]] },
        { label: '70×50', aliases: [[48,68],[49,69],[50,70],[51,71],[52,72],[68,48],[69,49],[70,50],[71,51],[72,52]] },
        { label: '80×50', aliases: [[48,78],[50,80],[52,82],[78,48],[80,50],[82,52]] },
        { label: '60×60', aliases: [[58,58],[60,60],[62,62]] },
        { label: '70×70', aliases: [[68,68],[70,70],[72,72]] },
        { label: '41×34', aliases: [[32,39],[33,40],[34,41],[35,42],[39,32],[40,33],[41,34],[42,35]] },
        { label: '50×30', aliases: [[28,48],[30,50],[32,52],[48,28],[50,30],[52,32]] },
        { label: '40×40', aliases: [[38,38],[40,40],[42,42]] },
        { label: '80×60', aliases: [[58,78],[60,80],[62,82],[78,58],[80,60],[82,62]] },
        { label: '50×50', aliases: [[48,48],[50,50],[52,52]] },
      ]
      const normalizeSize = (w, h, d) => {
        if (d) {
          const sorted2 = [parseInt(w), parseInt(h)].sort((a, b) => b - a)
          return `${sorted2[0]}×${sorted2[1]}×${parseInt(d)}`
        }
        const a = parseInt(w), b = parseInt(h)
        const sorted = [a, b].sort((x, y) => y - x)
        for (const group of SIZE_GROUPS) {
          for (const alias of group.aliases) {
            const aliasSorted = [...alias].sort((x, y) => y - x)
            if (Math.abs(sorted[0] - aliasSorted[0]) <= 2 && Math.abs(sorted[1] - aliasSorted[1]) <= 2) {
              return group.label
            }
          }
        }
        return `${sorted[0]}×${sorted[1]}`
      }
      const materialKeywords = [
        { keys: ['памятью', 'памят', 'memory'], zh: '记忆棉', en: 'Memory Foam' },
        { keys: ['латекс', 'latex'], zh: '乳胶', en: 'Latex' },
        { keys: ['пух', 'пухом', 'down'], zh: '羽绒', en: 'Down' },
        { keys: ['лебяжь', 'лебяжий'], zh: '鹅绒', en: 'Swan Down' },
        { keys: ['силиконизированн', 'силикон'], zh: '硅化纤维', en: 'Siliconized Fiber' },
        { keys: ['холлофайбер', 'холлофайб'], zh: '中空纤维', en: 'Hollofayber' },
        { keys: ['микрофибр', 'microfiber'], zh: '超细纤维', en: 'Microfiber' },
        { keys: ['овечь', 'овечья', 'шерст'], zh: '羊毛', en: 'Wool' },
        { keys: ['гречнев', 'buckwheat'], zh: '荞麦壳', en: 'Buckwheat' },
        { keys: ['полиуретан', 'пенополиуретан', 'foam'], zh: '聚氨酯海绵', en: 'PU Foam' },
        { keys: ['гелев', 'гелем', 'gel'], zh: '凝胶', en: 'Gel' },
        { keys: ['бамбук', 'bamboo'], zh: '竹纤维', en: 'Bamboo' },
        { keys: ['искусственн', 'искусственног'], zh: '人造纤维', en: 'Artificial Fiber' },
        { keys: ['эвкалипт', 'eucalyptus'], zh: '桉树纤维', en: 'Eucalyptus' },
        { keys: ['кокосов'], zh: '椰棕', en: 'Coconut Coir' },
        { keys: ['хлопк', 'хлопков', 'cotton'], zh: '纯棉', en: 'Cotton' },
        { keys: ['натуральн', 'natural'], zh: '天然材质', en: 'Natural' },
      ]
      const sizeStats = {}
      const materialStats = {}
      const sizeMaterialMatrix = {}
      let noSizeCount = 0
      let noMaterialCount = 0
      products.forEach(p => {
        const name = (p.name || '').toLowerCase()
        let sizeMatch = name.match(sizeCmRegex) || name.match(sizeRegex)
        let sizeLabel = ''
        if (sizeMatch) {
          const w = sizeMatch[1], h = sizeMatch[2], d = sizeMatch[3]
          sizeLabel = normalizeSize(w, h, d)
        }
        if (!sizeLabel) { noSizeCount++; sizeLabel = '未知尺寸' }
        let materialLabel = ''
        for (const mk of materialKeywords) {
          if (mk.keys.some(k => name.includes(k))) { materialLabel = mk.zh; break }
        }
        if (!materialLabel) { noMaterialCount++; materialLabel = '未知材质' }
        if (!sizeStats[sizeLabel]) sizeStats[sizeLabel] = { count: 0, qty: 0, sales: 0 }
        sizeStats[sizeLabel].count++
        sizeStats[sizeLabel].qty += p.qty
        sizeStats[sizeLabel].sales += p.sales
        if (!materialStats[materialLabel]) materialStats[materialLabel] = { count: 0, qty: 0, sales: 0 }
        materialStats[materialLabel].count++
        materialStats[materialLabel].qty += p.qty
        materialStats[materialLabel].sales += p.sales
        const matrixKey = `${sizeLabel}|${materialLabel}`
        if (!sizeMaterialMatrix[matrixKey]) sizeMaterialMatrix[matrixKey] = { count: 0, qty: 0, sales: 0 }
        sizeMaterialMatrix[matrixKey].count++
        sizeMaterialMatrix[matrixKey].qty += p.qty
        sizeMaterialMatrix[matrixKey].sales += p.sales
      })
      const sizeData = Object.entries(sizeStats)
        .filter(([name]) => name !== '未知尺寸')
        .sort((a, b) => b[1].sales - a[1].sales)
        .map(([name, d]) => ({ name, ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0, share: (d.count / products.length * 100).toFixed(1) }))
      const materialData = Object.entries(materialStats)
        .filter(([name]) => name !== '未知材质')
        .sort((a, b) => b[1].sales - a[1].sales)
        .map(([name, d]) => ({ name, ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0, share: (d.count / products.length * 100).toFixed(1) }))
      const crossData = Object.entries(sizeMaterialMatrix)
        .filter(([key]) => !key.includes('未知尺寸') && !key.includes('未知材质'))
        .sort((a, b) => b[1].sales - a[1].sales)
        .map(([key, d]) => {
          const [size, material] = key.split('|')
          return { size, material, ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0 }
        })
      const topSize = sizeData[0]?.name || ''
      const topMaterial = materialData[0]?.name || ''
      const sizeCoverage = ((products.length - noSizeCount) / products.length * 100).toFixed(1)
      const materialCoverage = ((products.length - noMaterialCount) / products.length * 100).toFixed(1)
      return { sizeData, materialData, crossData, topSize, topMaterial, sizeCoverage, materialCoverage, noSizeCount, noMaterialCount }
    })()

    const isHairCareCategory = /护发|发膜|喷雾|маска|спрей|hair|волос|美容.*卫生/i.test(topCatName)
    const ingredientData = (() => {
      if (!isHairCareCategory) return null
      const ingredientKeywords = [
        { keys: ['кератин', 'кератином', 'keratin'], zh: '角蛋白', category: '蛋白质' },
        { keys: ['коллаген', 'коллагеном', 'collagen'], zh: '胶原蛋白', category: '蛋白质' },
        { keys: ['протеин', 'протеинов', 'protein'], zh: '蛋白质', category: '蛋白质' },
        { keys: ['аминокислот', 'amino acid'], zh: '氨基酸', category: '蛋白质' },
        { keys: ['шелк', 'silk'], zh: '丝蛋白', category: '蛋白质' },
        { keys: ['ботокс', 'botox'], zh: '头发水光针', category: '护理技术' },
        { keys: ['ламинирован', 'ламинировани', 'lamination'], zh: '角蛋白护理', category: '护理技术' },
        { keys: ['восстанавливающ', 'восстановлен', 'restoring', 'repair'], zh: '修复', category: '功效' },
        { keys: ['увлажняющ', 'увлажнен', 'moisturiz', 'hydrat'], zh: '保湿', category: '功效' },
        { keys: ['питательн', 'nourish'], zh: '滋养', category: '功效' },
        { keys: ['укрепляющ', 'укреплен', 'strengthen'], zh: '强韧', category: '功效' },
        { keys: ['объем', 'volume'], zh: '丰盈', category: '功效' },
        { keys: ['блеск', 'блеском', 'shine', 'gloss'], zh: '光泽', category: '功效' },
        { keys: ['сияни', 'radiance'], zh: '闪耀', category: '功效' },
        { keys: ['шелковист', 'silky'], zh: '丝滑', category: '功效' },
        { keys: ['гладк', 'smooth'], zh: '顺滑', category: '功效' },
        { keys: ['эластичн', 'elastic'], zh: '弹性', category: '功效' },
        { keys: ['послушн', 'manageable'], zh: '柔顺', category: '功效' },
        { keys: ['термозащит', 'heat protect'], zh: '防热损伤', category: '防护' },
        { keys: ['защит', 'protect'], zh: '防护', category: '防护' },
        { keys: ['экстракт', 'extract'], zh: '植物提取', category: '植物成分' },
        { keys: ['имбир', 'ginger'], zh: '生姜', category: '植物成分' },
        { keys: ['алоэ', 'aloe'], zh: '芦荟', category: '植物成分' },
        { keys: ['банан', 'banana'], zh: '香蕉', category: '植物成分' },
        { keys: ['ромашк', 'chamomile'], zh: '洋甘菊', category: '植物成分' },
        { keys: ['крапив', 'nettle'], zh: '荨麻', category: '植物成分' },
        { keys: ['лаванд', 'lavender'], zh: '薰衣草', category: '植物成分' },
        { keys: ['водоросл', 'seaweed', 'algae'], zh: '海藻', category: '植物成分' },
        { keys: ['мандарин', 'mandarin'], zh: '柑橘', category: '植物成分' },
        { keys: ['хмель', 'hops'], zh: '啤酒花', category: '植物成分' },
        { keys: ['полын', 'wormwood'], zh: '艾草', category: '植物成分' },
        { keys: ['масло', 'oil'], zh: '精油', category: '油脂' },
        { keys: ['арганов', 'argan'], zh: '摩洛哥坚果油', category: '油脂' },
        { keys: ['кокосов', 'coconut'], zh: '椰子油', category: '油脂' },
        { keys: ['касторов', 'castor'], zh: '蓖麻油', category: '油脂' },
        { keys: ['миндальн', 'almond'], zh: '杏仁油', category: '油脂' },
        { keys: ['жожоб', 'jojoba'], zh: '荷荷巴油', category: '油脂' },
        { keys: ['макадам', 'macadamia'], zh: '夏威夷果油', category: '油脂' },
        { keys: ['ши', 'shea'], zh: '乳木果油', category: '油脂' },
        { keys: ['репейн', 'burdock'], zh: '牛蒡油', category: '油脂' },
        { keys: ['липидн', 'lipid'], zh: '脂质', category: '脂质' },
        { keys: ['витамин', 'vitamin'], zh: '维生素', category: '维生素' },
        { keys: ['пантенол', 'panthenol'], zh: '泛醇(B5)', category: '维生素' },
        { keys: ['биотин', 'biotin'], zh: '生物素(B7)', category: '维生素' },
        { keys: ['гиалурон', 'hyaluron'], zh: '玻尿酸', category: '保湿剂' },
        { keys: ['гликерин', 'glycerin'], zh: '甘油', category: '保湿剂' },
        { keys: ['морск', 'salt', 'sea'], zh: '海盐', category: '矿物质' },
        { keys: ['соль', 'salt'], zh: '盐', category: '矿物质' },
        { keys: ['серебр', 'silver'], zh: '银离子', category: '矿物质' },
        { keys: ['цинк', 'zinc'], zh: '锌', category: '矿物质' },
        { keys: ['медь', 'copper'], zh: '铜', category: '矿物质' },
        { keys: ['фиолетов', 'purple', 'violet'], zh: '紫色修色', category: '调色' },
        { keys: ['серебрист', 'silver'], zh: '银色修色', category: '调色' },
        { keys: ['поврежден', 'damaged'], zh: '受损发质', category: '适用发质' },
        { keys: ['сух', 'dry'], zh: '干性发质', category: '适用发质' },
        { keys: ['окрашен', 'colored', 'dyed'], zh: '染后发质', category: '适用发质' },
        { keys: ['выпаден', 'hair loss', 'fall'], zh: '脱发', category: '适用发质' },
        { keys: ['кудряв', 'curly'], zh: '卷发', category: '适用发质' },
        { keys: ['порист', 'porous'], zh: '多孔发质', category: '适用发质' },
        { keys: ['обесцвечиван', 'bleach'], zh: '漂后发质', category: '适用发质' },
        { keys: ['осветлен', 'lighten'], zh: '浅色发质', category: '适用发质' },
        { keys: ['секущ', 'split'], zh: '分叉发质', category: '适用发质' },
        { keys: ['ломк', 'brittle'], zh: '易断发质', category: '适用发质' },
        { keys: ['пушащ', 'frizzy'], zh: '毛躁发质', category: '适用发质' },
      ]
      const ingredientStats = {}
      const categoryStats = {}
      const ingredientCoOccurrence = {}
      let productsWithIngredient = 0
      products.forEach(p => {
        const name = (p.name || '').toLowerCase()
        const matchedIngredients = []
        ingredientKeywords.forEach(ik => {
          if (ik.keys.some(k => name.includes(k))) {
            matchedIngredients.push(ik.zh)
            if (!ingredientStats[ik.zh]) ingredientStats[ik.zh] = { zh: ik.zh, category: ik.category, count: 0, sales: 0, qty: 0 }
            ingredientStats[ik.zh].count++
            ingredientStats[ik.zh].sales += p.sales
            ingredientStats[ik.zh].qty += p.qty
            if (!categoryStats[ik.category]) categoryStats[ik.category] = { count: 0, sales: 0, qty: 0 }
            categoryStats[ik.category].count++
            categoryStats[ik.category].sales += p.sales
            categoryStats[ik.category].qty += p.qty
          }
        })
        if (matchedIngredients.length > 0) productsWithIngredient++
        for (let i = 0; i < matchedIngredients.length; i++) {
          for (let j = i + 1; j < matchedIngredients.length; j++) {
            const pair = [matchedIngredients[i], matchedIngredients[j]].sort().join('+')
            if (!ingredientCoOccurrence[pair]) ingredientCoOccurrence[pair] = { count: 0, sales: 0 }
            ingredientCoOccurrence[pair].count++
            ingredientCoOccurrence[pair].sales += p.sales
          }
        }
      })
      const allIngredients = Object.values(ingredientStats)
        .sort((a, b) => b.sales - a.sales)
        .map(d => ({ ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0, share: (d.count / products.length * 100).toFixed(1) }))
      const categoryData = Object.entries(categoryStats)
        .sort((a, b) => b[1].sales - a[1].sales)
        .map(([name, d]) => ({ name, ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0 }))
      const topPairs = Object.entries(ingredientCoOccurrence)
        .sort((a, b) => b[1].sales - a[1].sales)
        .slice(0, 10)
        .map(([pair, d]) => ({ pair, count: d.count, sales: d.sales }))
      const coverage = (productsWithIngredient / products.length * 100).toFixed(1)
      const topIngredient = allIngredients[0]?.zh || ''
      const topCategory = categoryData[0]?.name || ''
      const proteinIngredients = allIngredients.filter(d => d.category === '蛋白质')
      const plantIngredients = allIngredients.filter(d => d.category === '植物成分')
      const oilIngredients = allIngredients.filter(d => d.category === '油脂')
      const effectIngredients = allIngredients.filter(d => d.category === '功效')
      const hairTypeIngredients = allIngredients.filter(d => d.category === '适用发质')
      return { allIngredients, categoryData, topPairs, coverage, topIngredient, topCategory, proteinIngredients, plantIngredients, oilIngredients, effectIngredients, hairTypeIngredients }
    })()

    const isHairMaskCategory = isHairCareCategory && /маска|发膜|mask/i.test(topCatName)
    let hairMaskAnalysis = null
    if (isHairMaskCategory) {
      const maskProducts = products.filter(p => {
        const name = (p.name || '').toLowerCase()
        return name.includes('маска') || name.includes('маской') || name.includes('маску') || name.includes('mask')
      })
      if (maskProducts.length >= 3) {
        const getWeight = (name) => {
          const n = (name || '').toLowerCase()
          const m = n.match(/(\d+)\s*(мл|ml|г|g)/)
          if (m) return { value: parseInt(m[1]), unit: m[2].startsWith('м') || m[2] === 'ml' ? 'ml' : 'g' }
          return null
        }
        const getEffect = (name) => {
          const n = (name || '').toLowerCase()
          const effects = []
          if (n.includes('восстанавлива') || n.includes('реставрац') || n.includes('repair')) effects.push('修复')
          if (n.includes('увлажня') || n.includes('hydrat') || n.includes('moistur')) effects.push('保湿')
          if (n.includes('питательн') || n.includes('nourish')) effects.push('滋养')
          if (n.includes('укрепля') || n.includes('strengthen')) effects.push('强韧')
          if (n.includes('блеск') || n.includes('shine') || n.includes('gloss')) effects.push('光泽')
          if (n.includes('объем') || n.includes('volume')) effects.push('丰盈')
          if (n.includes('защит') || n.includes('protect')) effects.push('防护')
          if (n.includes('разглажива') || n.includes('smooth') || n.includes('anti-frizz')) effects.push('顺滑')
          if (n.includes('кератин') || n.includes('keratin')) effects.push('角蛋白')
          if (n.includes('коллаген') || n.includes('collagen')) effects.push('胶原蛋白')
          if (n.includes('масло') || n.includes('oil')) effects.push('精油')
          if (n.includes('керамид') || n.includes('ceramide')) effects.push('神经酰胺')
          if (n.includes('икра') || n.includes('caviar')) effects.push('鱼子酱')
          if (n.includes('шелк') || n.includes('silk')) effects.push('丝蛋白')
          if (n.includes('ботокс') || n.includes('botox')) effects.push('玻尿酸/肉毒')
          if (n.includes('ламинац') || n.includes('lamination')) effects.push('拉直/烫')
          if (n.includes('окрашен') || n.includes('colored') || n.includes('dyed')) effects.push('染后护理')
          if (n.includes('поврежден') || n.includes('damaged')) effects.push('受损修护')
          return effects.length > 0 ? effects : null
        }
        const getHairType = (name) => {
          const n = (name || '').toLowerCase()
          const types = []
          if (n.includes('сух') || n.includes('dry')) types.push('干性')
          if (n.includes('жирн') || n.includes('oily')) types.push('油性')
          if (n.includes('поврежден') || n.includes('damaged')) types.push('受损')
          if (n.includes('окрашен') || n.includes('colored') || n.includes('dyed')) types.push('染烫')
          if (n.includes('тонк') || n.includes('fine')) types.push('细软')
          if (n.includes('кудряв') || n.includes('curly')) types.push('卷发')
          if (n.includes('пушащ') || n.includes('frizz')) types.push('毛躁')
          return types.length > 0 ? types : null
        }

        const weightStats = {}
        const effectStats = {}
        const hairTypeStats = {}
        const priceByWeight = {}
        let totalMaskSales = 0
        let totalMaskQty = 0

        maskProducts.forEach(p => {
          const name = (p.name || '').toLowerCase()
          const weight = getWeight(name)
          const effects = getEffect(name)
          const hairTypes = getHairType(name)
          totalMaskSales += p.sales || 0
          totalMaskQty += p.qty || 0

          if (weight) {
            const wKey = `${weight.value}${weight.unit}`
            if (!weightStats[wKey]) weightStats[wKey] = { count: 0, sales: 0, qty: 0, prices: [] }
            weightStats[wKey].count++
            weightStats[wKey].sales += p.sales || 0
            weightStats[wKey].qty += p.qty || 0
            weightStats[wKey].prices.push(p.price || 0)
          }
          if (effects) {
            effects.forEach(e => {
              if (!effectStats[e]) effectStats[e] = { count: 0, sales: 0, qty: 0 }
              effectStats[e].count++
              effectStats[e].sales += p.sales || 0
              effectStats[e].qty += p.qty || 0
            })
          }
          if (hairTypes) {
            hairTypes.forEach(t => {
              if (!hairTypeStats[t]) hairTypeStats[t] = { count: 0, sales: 0, qty: 0 }
              hairTypeStats[t].count++
              hairTypeStats[t].sales += p.sales || 0
              hairTypeStats[t].qty += p.qty || 0
            })
          }
          if (weight && p.price > 0) {
            const bucket = weight.value <= 200 ? '≤200ml/g' : weight.value <= 500 ? '201-500ml/g' : weight.value <= 1000 ? '501-1000ml/g' : '1000ml/g+'
            if (!priceByWeight[bucket]) priceByWeight[bucket] = { prices: [], qty: 0, sales: 0 }
            priceByWeight[bucket].prices.push(p.price)
            priceByWeight[bucket].qty += p.qty || 0
            priceByWeight[bucket].sales += p.sales || 0
          }
        })

        const sortedWeights = Object.entries(weightStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({
            name: key,
            count: d.count,
            sales: d.sales,
            qty: d.qty,
            avgPrice: d.prices.length > 0 ? Math.round(d.prices.reduce((s, p) => s + p, 0) / d.prices.length) : 0,
            minPrice: d.prices.length > 0 ? Math.min(...d.prices.filter(p => p > 0)) : 0,
            maxPrice: d.prices.length > 0 ? Math.max(...d.prices) : 0,
          }))

        const sortedEffects = Object.entries(effectStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({ name: key, count: d.count, sales: d.sales, qty: d.qty }))

        const sortedHairTypes = Object.entries(hairTypeStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({ name: key, count: d.count, sales: d.sales, qty: d.qty }))

        const priceByWeightData = Object.entries(priceByWeight)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, d]) => ({
            name: key,
            avgPrice: d.prices.length > 0 ? Math.round(d.prices.reduce((s, p) => s + p, 0) / d.prices.length) : 0,
            minPrice: d.prices.length > 0 ? Math.min(...d.prices.filter(p => p > 0)) : 0,
            maxPrice: d.prices.length > 0 ? Math.max(...d.prices) : 0,
            qty: d.qty,
            sales: d.sales,
          }))

        const top10Mask = [...maskProducts].sort((a, b) => b.qty - a.qty).slice(0, 10).map(p => {
          const weight = getWeight(p.name || '')
          const effects = getEffect(p.name || '')
          const hairTypes = getHairType(p.name || '')
          return {
            ...p,
            _weight: weight ? `${weight.value}${weight.unit}` : null,
            _effects: effects ? effects.join('、') : null,
            _hairTypes: hairTypes ? hairTypes.join('、') : null,
            _pricePer100ml: weight && p.price > 0 ? (p.price / weight.value * 100).toFixed(1) : null,
          }
        })

        const mask300g = maskProducts.filter(p => {
          const w = getWeight(p.name || '')
          return w && (w.value >= 250 && w.value <= 350)
        })
        const mask300gAvgPrice = mask300g.length > 0 ? mask300g.reduce((s, p) => s + (p.price || 0), 0) / mask300g.length : 0
        const mask300gAvgQty = mask300g.length > 0 ? mask300g.reduce((s, p) => s + (p.qty || 0), 0) / mask300g.length : 0
        const caviarProducts = maskProducts.filter(p => {
          const n = (p.name || '').toLowerCase()
          return n.includes('икра') || n.includes('caviar')
        })
        const caviarAvgPrice = caviarProducts.length > 0 ? caviarProducts.reduce((s, p) => s + (p.price || 0), 0) / caviarProducts.length : 0
        const caviarAvgQty = caviarProducts.length > 0 ? caviarProducts.reduce((s, p) => s + (p.qty || 0), 0) / caviarProducts.length : 0

        const COMPETITOR_MASK = { weight: '350g', priceRUB: 350, brand: '竞品(ikra 350ml)' }
        const OUR_MASK = {
          weight: '300g',
          priceCNY: 9,
          logistics: 15,
          ourPriceRUB: 459,
          features: ['深层滋养受损发丝', '抚平毛躁改善打结', '冲洗后柔顺易梳理', '提升光泽度与丝滑感', '适用于干枯/染烫/毛躁发质', '沙龙级护理体验', '鱼子精华修护配方'],
          positioning: '沙龙级鱼子酱修护发膜',
          targetHairTypes: ['干性', '受损', '染烫', '毛躁'],
          targetEffects: ['滋养', '修复', '顺滑', '光泽'],
        }

        const ourMaskPriceRUB = OUR_MASK.ourPriceRUB
        const maskCalcProfit = (priceRub) => {
          const revenue = priceRub * R
          const ozonFee = priceRub * 0.12 * R
          const adFee = priceRub * 0.10 * R
          const exchangeLoss = priceRub * 0.01 * R
          const afterSalesCost = priceRub * 0.03 * R
          const logistics = OUR_MASK.logistics
          const totalCost = OUR_MASK.priceCNY + ozonFee + adFee + exchangeLoss + afterSalesCost + logistics
          const profit = revenue - totalCost
          const rate = revenue > 0 ? (profit / revenue * 100) : 0
          return { profit, rate, ozonFee: Math.round(priceRub * 0.12), adFee: Math.round(priceRub * 0.10), exchangeLoss: Math.round(priceRub * 0.01), afterSales: Math.round(priceRub * 0.03), logistics, totalCost }
        }

        const profitAtOurPrice = maskCalcProfit(OUR_MASK.ourPriceRUB)
        const profitAtCompetitor = maskCalcProfit(COMPETITOR_MASK.priceRUB)
        const profitAt300gAvg = maskCalcProfit(mask300gAvgPrice)

        const maskTopBrands = {}
        maskProducts.forEach(p => {
          const b = p.brand || '未知品牌'
          if (!maskTopBrands[b]) maskTopBrands[b] = { count: 0, sales: 0, qty: 0 }
          maskTopBrands[b].count++
          maskTopBrands[b].sales += p.sales || 0
          maskTopBrands[b].qty += p.qty || 0
        })
        const sortedMaskBrands = Object.entries(maskTopBrands)
          .sort((a, b) => b[1].qty - a[1].qty)
          .slice(0, 10)
          .map(([name, d]) => ({ name, count: d.count, sales: d.sales, qty: d.qty, avgPrice: d.count > 0 ? Math.round(maskProducts.filter(p => (p.brand || '未知品牌') === name).reduce((s, p) => s + (p.price || 0), 0) / d.count) : 0 }))

        hairMaskAnalysis = {
          totalProducts: maskProducts.length,
          totalSales: totalMaskSales,
          totalQty: totalMaskQty,
          weightData: sortedWeights,
          effectData: sortedEffects,
          hairTypeData: sortedHairTypes,
          priceByWeightData,
          top10Products: top10Mask,
          topBrands: sortedMaskBrands,
          mask300gCount: mask300g.length,
          mask300gAvgPrice: Math.round(mask300gAvgPrice),
          mask300gAvgQty: Math.round(mask300gAvgQty),
          caviarCount: caviarProducts.length,
          caviarAvgPrice: Math.round(caviarAvgPrice),
          caviarAvgQty: Math.round(caviarAvgQty),
          competitorMask: COMPETITOR_MASK,
          ourMask: OUR_MASK,
          ourMaskPriceRUB: Math.round(ourMaskPriceRUB),
          profitAtOurPrice,
          profitAtCompetitor,
          profitAt300gAvg,
        }
      }
    }

    const isSprayCategory = isHairCareCategory && /спрей|喷雾|spray|мист|mist|mist|эфирн|эфирное.*масло|арома/i.test(topCatName)
    let sprayAnalysis = null
    if (isSprayCategory) {
      const sprayProducts = products.filter(p => {
        const name = (p.name || '').toLowerCase()
        return name.includes('спрей') || name.includes('spray') || name.includes('мист') || name.includes('mist') || name.includes('эфирное масло') || name.includes('аромамасло') || name.includes('ароматический спрей')
      })
      if (sprayProducts.length >= 3) {
        const getVolume = (name) => {
          const n = (name || '').toLowerCase()
          const m = n.match(/(\d+)\s*(мл|ml)/)
          if (m) return { value: parseInt(m[1]), unit: 'ml' }
          return null
        }
        const getSprayEffect = (name) => {
          const n = (name || '').toLowerCase()
          const effects = []
          if (n.includes('увлажня') || n.includes('hydrat') || n.includes('moistur')) effects.push('保湿')
          if (n.includes('питательн') || n.includes('nourish')) effects.push('滋养')
          if (n.includes('блеск') || n.includes('shine') || n.includes('gloss')) effects.push('光泽')
          if (n.includes('разглажива') || n.includes('smooth') || n.includes('anti-frizz')) effects.push('顺滑')
          if (n.includes('защит') || n.includes('protect')) effects.push('防护')
          if (n.includes('термозащит') || n.includes('heat protect')) effects.push('防热损伤')
          if (n.includes('восстанавлива') || n.includes('repair')) effects.push('修复')
          if (n.includes('укрепля') || n.includes('strengthen')) effects.push('强韧')
          if (n.includes('объем') || n.includes('volume')) effects.push('丰盈')
          if (n.includes('антистатик') || n.includes('antistat')) effects.push('抗静电')
          if (n.includes('легк') || n.includes('расчесыван') || n.includes('easy comb')) effects.push('易梳理')
          if (n.includes('аромат') || n.includes('парфюм') || n.includes('арома')) effects.push('香氛')
          if (n.includes('масло') || n.includes('oil') || n.includes('эфирн')) effects.push('精油')
          if (n.includes('кератин') || n.includes('keratin')) effects.push('角蛋白')
          if (n.includes('коллаген') || n.includes('collagen')) effects.push('胶原蛋白')
          if (n.includes('экстракт') || n.includes('extract')) effects.push('植物提取')
          if (n.includes('икра') || n.includes('caviar')) effects.push('鱼子酱')
          if (n.includes('арганов') || n.includes('арган') || n.includes('argan')) effects.push('摩洛哥坚果油')
          if (n.includes('кокос') || n.includes('coconut')) effects.push('椰子油')
          if (n.includes('макадам') || n.includes('macadamia')) effects.push('澳洲坚果油')
          if (n.includes('окрашен') || n.includes('colored') || n.includes('dyed')) effects.push('染后护理')
          if (n.includes('поврежден') || n.includes('damaged')) effects.push('受损修护')
          if (n.includes('сияни') || n.includes('radiance') || n.includes('люкс')) effects.push('闪耀/奢华')
          return effects.length > 0 ? effects : null
        }
        const getSprayHairType = (name) => {
          const n = (name || '').toLowerCase()
          const types = []
          if (n.includes('сух') || n.includes('dry')) types.push('干性')
          if (n.includes('жирн') || n.includes('oily')) types.push('油性')
          if (n.includes('поврежден') || n.includes('damaged')) types.push('受损')
          if (n.includes('окрашен') || n.includes('colored') || n.includes('dyed')) types.push('染烫')
          if (n.includes('тонк') || n.includes('fine')) types.push('细软')
          if (n.includes('кудряв') || n.includes('curly')) types.push('卷发')
          if (n.includes('пушащ') || n.includes('frizz') || n.includes('пух')) types.push('毛躁')
          if (n.includes('тускл') || n.includes('dull')) types.push('暗哑')
          return types.length > 0 ? types : null
        }

        const volumeStats = {}
        const sprayEffectStats = {}
        const sprayHairTypeStats = {}
        const priceByVolume = {}
        let totalSpraySales = 0
        let totalSprayQty = 0

        sprayProducts.forEach(p => {
          const name = (p.name || '').toLowerCase()
          const volume = getVolume(name)
          const effects = getSprayEffect(name)
          const hairTypes = getSprayHairType(name)
          totalSpraySales += p.sales || 0
          totalSprayQty += p.qty || 0

          if (volume) {
            const vKey = `${volume.value}${volume.unit}`
            if (!volumeStats[vKey]) volumeStats[vKey] = { count: 0, sales: 0, qty: 0, prices: [] }
            volumeStats[vKey].count++
            volumeStats[vKey].sales += p.sales || 0
            volumeStats[vKey].qty += p.qty || 0
            volumeStats[vKey].prices.push(p.price || 0)
          }
          if (effects) {
            effects.forEach(e => {
              if (!sprayEffectStats[e]) sprayEffectStats[e] = { count: 0, sales: 0, qty: 0 }
              sprayEffectStats[e].count++
              sprayEffectStats[e].sales += p.sales || 0
              sprayEffectStats[e].qty += p.qty || 0
            })
          }
          if (hairTypes) {
            hairTypes.forEach(t => {
              if (!sprayHairTypeStats[t]) sprayHairTypeStats[t] = { count: 0, sales: 0, qty: 0 }
              sprayHairTypeStats[t].count++
              sprayHairTypeStats[t].sales += p.sales || 0
              sprayHairTypeStats[t].qty += p.qty || 0
            })
          }
          if (volume && p.price > 0) {
            const bucket = volume.value <= 50 ? '≤50ml' : volume.value <= 100 ? '51-100ml' : volume.value <= 150 ? '101-150ml' : volume.value <= 200 ? '151-200ml' : '200ml+'
            if (!priceByVolume[bucket]) priceByVolume[bucket] = { prices: [], qty: 0, sales: 0 }
            priceByVolume[bucket].prices.push(p.price)
            priceByVolume[bucket].qty += p.qty || 0
            priceByVolume[bucket].sales += p.sales || 0
          }
        })

        const sortedVolumes = Object.entries(volumeStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({
            name: key,
            count: d.count,
            sales: d.sales,
            qty: d.qty,
            avgPrice: d.prices.length > 0 ? Math.round(d.prices.reduce((s, p) => s + p, 0) / d.prices.length) : 0,
            minPrice: d.prices.length > 0 ? Math.min(...d.prices.filter(p => p > 0)) : 0,
            maxPrice: d.prices.length > 0 ? Math.max(...d.prices) : 0,
          }))

        const sortedSprayEffects = Object.entries(sprayEffectStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({ name: key, count: d.count, sales: d.sales, qty: d.qty }))

        const sortedSprayHairTypes = Object.entries(sprayHairTypeStats)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([key, d]) => ({ name: key, count: d.count, sales: d.sales, qty: d.qty }))

        const priceByVolumeData = Object.entries(priceByVolume)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, d]) => ({
            name: key,
            avgPrice: d.prices.length > 0 ? Math.round(d.prices.reduce((s, p) => s + p, 0) / d.prices.length) : 0,
            minPrice: d.prices.length > 0 ? Math.min(...d.prices.filter(p => p > 0)) : 0,
            maxPrice: d.prices.length > 0 ? Math.max(...d.prices) : 0,
            qty: d.qty,
            sales: d.sales,
          }))

        const top10Spray = [...sprayProducts].sort((a, b) => b.qty - a.qty).slice(0, 10).map(p => {
          const volume = getVolume(p.name || '')
          const effects = getSprayEffect(p.name || '')
          const hairTypes = getSprayHairType(p.name || '')
          return {
            ...p,
            _volume: volume ? `${volume.value}${volume.unit}` : null,
            _effects: effects ? effects.join('、') : null,
            _hairTypes: hairTypes ? hairTypes.join('、') : null,
            _pricePer100ml: volume && p.price > 0 ? (p.price / volume.value * 100).toFixed(1) : null,
          }
        })

        const spray100ml = sprayProducts.filter(p => {
          const v = getVolume(p.name || '')
          return v && (v.value >= 80 && v.value <= 120)
        })
        const spray100mlAvgPrice = spray100ml.length > 0 ? spray100ml.reduce((s, p) => s + (p.price || 0), 0) / spray100ml.length : 0
        const spray100mlAvgQty = spray100ml.length > 0 ? spray100ml.reduce((s, p) => s + (p.qty || 0), 0) / spray100ml.length : 0
        const oilSprayProducts = sprayProducts.filter(p => {
          const n = (p.name || '').toLowerCase()
          return n.includes('масло') || n.includes('oil') || n.includes('эфирн') || n.includes('арганов') || n.includes('кокос')
        })
        const oilSprayAvgPrice = oilSprayProducts.length > 0 ? oilSprayProducts.reduce((s, p) => s + (p.price || 0), 0) / oilSprayProducts.length : 0
        const oilSprayAvgQty = oilSprayProducts.length > 0 ? oilSprayProducts.reduce((s, p) => s + (p.qty || 0), 0) / oilSprayProducts.length : 0

        const COMPETITORS_SPRAY = [
          { id: 1, volume: '50ml', priceRUB: 255, brand: '竞品1', positioning: '重滋润修护型·小容量溢价', ingredients: '环戊硅氧烷、矿物油、二甲基硅酚、阿莫二甲硅油、乳木果脂、夏威夷果油', risks: ['香精过敏原(柠檬烯/芳樟醇/香豆素)', '矿物油降低高端感', '50ml单位价偏高'], strengths: ['手感强立刻顺', '乳木果脂滋润厚重', '适合干枯粗硬漂染发'], score: { gloss: 3, smooth: 5, moisture: 5, light: 1 } },
          { id: 2, volume: '100ml', priceRUB: 393, brand: '竞品2', positioning: '中端主流爆款·走量型', ingredients: 'Dimethicone、Cyclomethicone、Cyclopentasiloxane、Argan Oil、Jojoba、Macadamia、Mineral Oil、CI47000、CI26100', risks: ['色粉CI47000/CI26100被嫌"添加剂多"', '矿物油降低高端感', '缺少功能型活性物'], strengths: ['成熟配方市场接受度高', '坚果油概念易做滋养叙事', '成本控制优秀'], score: { gloss: 3, smooth: 4, moisture: 3, light: 2 } },
          { id: 3, volume: '100ml', priceRUB: 322, brand: '竞品3', positioning: '低价走量·豪华成分表包装', ingredients: '环戊硅氧烷、Dimethiconol、Phenyl Trimethicone、IPM、甜杏仁油、夏威夷果油、葡萄籽油、角鲨烷、荷荷巴油、草莓籽油、摩洛哥坚果油、Bisabolol、牛蒡根/越橘叶/银杏叶提取物', risks: ['植物提取物含量极低(营销型)', '成分复杂稳定性风险', '提取物多合规资料麻烦'], strengths: ['Phenyl Trimethicone高反光光泽感最强', '成分表"看起来豪华"营销强', 'Bisabolol舒缓成分头皮友好'], score: { gloss: 5, smooth: 4, moisture: 2, light: 4 } },
          { id: 4, volume: '100ml', priceRUB: 524, brand: '竞品4', positioning: '高价高端·轻奢沙龙感', ingredients: '环戊硅氧烷、Dimethiconol、IPM、环己硅氧烷(D6)、夏威夷果油、牛油果油、甜杏仁油、BHT', risks: ['BHT争议成分(虽合规)', '香精过敏原多', '定价偏高需品牌支撑'], strengths: ['D5+D6体系顺滑不粘', 'IPM轻薄干爽轻奢感', '牛油果油高端油脂'], score: { gloss: 4, smooth: 5, moisture: 2, light: 5 } },
          { id: 5, volume: '100ml', priceRUB: 497, brand: '竞品5', positioning: '中配方+高售价·品牌溢价', ingredients: 'Dimethicone、Cyclomethicone、Cyclopentasiloxane、Argan Oil、Jojoba、Macadamia、Mineral Oil、CI47000、CI26100', risks: ['与竞品2高度同质化', '矿物油+色粉降低高端感', '无配方创新点'], strengths: ['顺滑+光泽效果稳定', '配方成熟复购稳定', '高端价位品牌溢价空间'], score: { gloss: 3, smooth: 4, moisture: 3, light: 2 } },
        ]
        const OUR_SPRAY = {
          volume: '100ml',
          priceCNY: 12,
          logistics: 18,
          ourPriceRUB: 499,
          ingredients: '棕榈酸乙基己酯、异十二烷、C13-14异链烷烃、山茶花提取物、霍霍巴籽油、聚二甲基硅氧烷醇、油橄榄果油、生育酚乙酸酯、(日用)香精',
          features: ['异十二烷+C13-14异链烷烃·超轻盈基底', '山茶花提取物·天然修护抗氧化', '霍霍巴籽油+橄榄油·双重植物油滋养', '聚二甲基硅氧烷醇·顺滑不粘不塌', '生育酚乙酸酯(维E)·防热损伤', '轻盈不油腻·细软发友好', '无矿物油·无色粉·更干净'],
          positioning: '轻盈不塌·无矿物油·高端修护',
          targetHairTypes: ['干性', '受损', '染烫', '毛躁', '细软'],
          targetEffects: ['顺滑', '光泽', '防热损伤', '轻盈不塌'],
          score: { gloss: 4, smooth: 4, moisture: 3, light: 5 },
          skus: [
            { volume: '50ml', priceCNY: 8, logistics: 15, ourPriceRUB: 299, label: '试用装' },
            { volume: '100ml', priceCNY: 12, logistics: 18, ourPriceRUB: 499, label: '标准装' },
            { volume: '150ml', priceCNY: 14, logistics: 20, ourPriceRUB: 599, label: '正装' },
          ],
        }

        const sprayCalcProfit = (priceRub, costCNY, logisticsCNY) => {
          const revenue = priceRub * R
          const ozonFee = priceRub * 0.12 * R
          const adFee = priceRub * 0.10 * R
          const exchangeLoss = priceRub * 0.01 * R
          const afterSalesCost = priceRub * 0.03 * R
          const totalCost = costCNY + ozonFee + adFee + exchangeLoss + afterSalesCost + logisticsCNY
          const profit = revenue - totalCost
          const rate = revenue > 0 ? (profit / revenue * 100) : 0
          return { profit, rate, ozonFee: Math.round(priceRub * 0.12), adFee: Math.round(priceRub * 0.10), exchangeLoss: Math.round(priceRub * 0.01), afterSales: Math.round(priceRub * 0.03), logistics: logisticsCNY, totalCost }
        }

        const sprayProfitBySku = OUR_SPRAY.skus.map(s => ({
          ...s,
          standard: sprayCalcProfit(s.ourPriceRUB, s.priceCNY, s.logistics),
          express: sprayCalcProfit(s.ourPriceRUB, s.priceCNY, s.logistics + 5),
          economy: sprayCalcProfit(s.ourPriceRUB, s.priceCNY, Math.max(0, s.logistics - 5)),
        }))
        const sprayTopBrands = {}
        sprayProducts.forEach(p => {
          const b = p.brand || '未知品牌'
          if (!sprayTopBrands[b]) sprayTopBrands[b] = { count: 0, sales: 0, qty: 0 }
          sprayTopBrands[b].count++
          sprayTopBrands[b].sales += p.sales || 0
          sprayTopBrands[b].qty += p.qty || 0
        })
        const sortedSprayBrands = Object.entries(sprayTopBrands)
          .sort((a, b) => b[1].qty - a[1].qty)
          .slice(0, 10)
          .map(([name, d]) => ({ name, count: d.count, sales: d.sales, qty: d.qty, avgPrice: d.count > 0 ? Math.round(sprayProducts.filter(p => (p.brand || '未知品牌') === name).reduce((s, p) => s + (p.price || 0), 0) / d.count) : 0 }))

        const sprayHhi = Object.values(sprayTopBrands).reduce((s, b) => { const share = (b.sales / totalSpraySales) * 100; return s + share * share }, 0)
        const sprayMarketPower = sprayHhi > 2500 ? '高度集中' : sprayHhi > 1500 ? '中度集中' : '竞争型'
        const sprayMarketConcentration = sortedSprayBrands.slice(0, 3).reduce((s, b) => s + (b.qty / totalSprayQty * 100), 0)
        const sprayMarketConcentrationTop10 = sortedSprayBrands.slice(0, 10).reduce((s, b) => s + (b.qty / totalSprayQty * 100), 0)
        const sprayAvgPrice = sprayProducts.length > 0 ? Math.round(sprayProducts.reduce((s, p) => s + (p.price || 0), 0) / sprayProducts.length) : 0

        const spray150ml = sprayProducts.filter(p => {
          const v = getVolume(p.name || '')
          return v && (v.value >= 120 && v.value <= 200)
        })
        const spray150mlAvgPrice = spray150ml.length > 0 ? spray150ml.reduce((s, p) => s + (p.price || 0), 0) / spray150ml.length : 0
        const spray150mlAvgQty = spray150ml.length > 0 ? spray150ml.reduce((s, p) => s + (p.qty || 0), 0) / spray150ml.length : 0
        const spray50ml = sprayProducts.filter(p => {
          const v = getVolume(p.name || '')
          return v && v.value <= 60
        })
        const spray50mlAvgPrice = spray50ml.length > 0 ? spray50ml.reduce((s, p) => s + (p.price || 0), 0) / spray50ml.length : 0
        const spray50mlAvgQty = spray50ml.length > 0 ? spray50ml.reduce((s, p) => s + (p.qty || 0), 0) / spray50ml.length : 0

        const volumeDistribution = sortedVolumes.map(v => ({
          name: v.name,
          count: v.count,
          qty: v.qty,
          pct: totalSprayQty > 0 ? (v.qty / totalSprayQty * 100).toFixed(1) : 0,
          avgPrice: v.avgPrice,
        }))

        const top10TotalQty = top10Spray.reduce((s, p) => s + (p.qty || 0), 0)
        const top10AvgDailyQty = Math.round(top10TotalQty / 30)
        const top10AvgDailyQtyPerProduct = top10Spray.length > 0 ? Math.round(top10TotalQty / 30 / top10Spray.length) : 0

        const sprayNewProducts180 = sprayProducts.filter(p => {
          if (!p.date) return false
          const d = new Date(p.date)
          if (isNaN(d.getTime())) return false
          return (now - d) <= days180
        }).sort((a, b) => b.qty - a.qty).slice(0, 10)
        const sprayNewProductTotalQty = sprayNewProducts180.reduce((s, p) => s + (p.qty || 0), 0)
        const sprayNewProductAvgDailyQtyPerProduct = sprayNewProducts180.length > 0 ? Math.round(sprayNewProductTotalQty / 30 / sprayNewProducts180.length) : 0

        const newProductEstByNewProduct = Math.max(1, Math.round(sprayNewProductAvgDailyQtyPerProduct * 0.30))
        const newProductEstByTop10 = Math.max(1, Math.round(top10AvgDailyQtyPerProduct * 0.10))
        const newProductEstDailyQty = Math.max(1, Math.round((newProductEstByNewProduct + newProductEstByTop10) / 2))
        const fullSizeStock = 100
        const trialSizeStock = 200
        const fullSizeSellDays = Math.round(fullSizeStock / newProductEstDailyQty)
        const trialSizeSellDays = Math.round(trialSizeStock / newProductEstDailyQty)
        const improvedFullSizeStock = 400
        const improvedFullSizeDomesticStock = 100
        const improvedTrialSizeStock = 200
        const improvedFullSizeSellDays = Math.round(improvedFullSizeStock / newProductEstDailyQty)
        const improvedTrialSizeSellDays = Math.round(improvedTrialSizeStock / newProductEstDailyQty)
        const finalStock150mlOverseas = 400
        const finalStock150mlDomestic = 100
        const finalStock150ml = finalStock150mlOverseas + finalStock150mlDomestic
        const finalStock50mlHairDryer = 400
        const finalStock50mlDomestic = 100
        const finalStock50mlOverseas = 200
        const finalStock50mlTotal = finalStock50mlHairDryer + finalStock50mlDomestic + finalStock50mlOverseas
        const final150mlSellDays = Math.round(finalStock150mlOverseas / newProductEstDailyQty)
        const final50mlSellDays = Math.round(finalStock50mlOverseas / newProductEstDailyQty)
        const productionDays = 25
        const productionDaysMin = 25
        const productionDaysMax = 25
        const reorderPoint = newProductEstDailyQty * productionDays

        const packagingAnalysis = {
          fullSize: { volume: '150ml', stock: fullSizeStock, avgMarketPrice: Math.round(spray150mlAvgPrice), marketProductCount: spray150ml.length, pricePer100ml: OUR_SPRAY.skus[2].ourPriceRUB / 150 * 100 },
          trialSize: { volume: '50ml', stock: trialSizeStock, avgMarketPrice: Math.round(spray50mlAvgPrice), marketProductCount: spray50ml.length, pricePer100ml: OUR_SPRAY.skus[0].ourPriceRUB / 50 * 100 },
          improvedFullSize: { volume: '150ml', stock: improvedFullSizeStock, domesticStock: improvedFullSizeDomesticStock, totalStock: improvedFullSizeStock + improvedFullSizeDomesticStock, sellDays: improvedFullSizeSellDays },
          improvedTrialSize: { volume: '50ml', stock: improvedTrialSizeStock, sellDays: improvedTrialSizeSellDays },
          finalStock: {
            size150ml: { overseas: finalStock150mlOverseas, domestic: finalStock150mlDomestic, total: finalStock150ml, sellDays: final150mlSellDays },
            size50ml: { hairDryer: finalStock50mlHairDryer, domestic: finalStock50mlDomestic, overseas: finalStock50mlOverseas, total: finalStock50mlTotal, sellDays: final50mlSellDays },
            totalStock: finalStock150ml + finalStock50mlTotal,
          },
          volumeDistribution,
          top10AvgDailyQty,
          top10AvgDailyQtyPerProduct,
          sprayNewProducts180Count: sprayNewProducts180.length,
          sprayNewProductAvgDailyQtyPerProduct,
          newProductEstByNewProduct,
          newProductEstByTop10,
          newProductEstDailyQty,
          fullSizeSellDays,
          trialSizeSellDays,
          productionDays,
          productionDaysMin,
          productionDaysMax,
          productionDaysDisplay: productionDaysMin === productionDaysMax ? `${productionDaysMin}天` : `${productionDaysMin}-${productionDaysMax}天`,
          reorderPoint,
          top10TotalQty,
        }

        sprayAnalysis = {
          totalProducts: sprayProducts.length,
          totalSales: totalSpraySales,
          totalQty: totalSprayQty,
          volumeData: sortedVolumes,
          effectData: sortedSprayEffects,
          hairTypeData: sortedSprayHairTypes,
          priceByVolumeData,
          top10Products: top10Spray,
          topBrands: sortedSprayBrands,
          sprayHhi,
          sprayMarketPower,
          sprayMarketConcentration,
          sprayMarketConcentrationTop10,
          sprayAvgPrice,
          spray100mlCount: spray100ml.length,
          spray100mlAvgPrice: Math.round(spray100mlAvgPrice),
          spray100mlAvgQty: Math.round(spray100mlAvgQty),
          oilSprayCount: oilSprayProducts.length,
          oilSprayAvgPrice: Math.round(oilSprayAvgPrice),
          oilSprayAvgQty: Math.round(oilSprayAvgQty),
          competitorsSpray: COMPETITORS_SPRAY,
          ourSpray: OUR_SPRAY,
          profitBySku: sprayProfitBySku,
          packagingAnalysis,
        }
      }
    }

    const isGlovesCategory = /手套|перчатк|glove/i.test(topCatName)
    let competitorAnalysis = null
    const nitrileGlovesData = (() => {
      if (!isGlovesCategory) return null
      const nitrileProducts = products.filter(p => {
        const name = (p.name || '').toLowerCase()
        return name.includes('нитрил') || name.includes('nitrile')
      })
      if (nitrileProducts.length === 0) return null

      const colorStats = {}
      const sizeStats = {}
      const useStats = {}
      const brandStatsLocal = {}
      const priceRangeStats = { '0-100': { count: 0, sales: 0, qty: 0 }, '100-200': { count: 0, sales: 0, qty: 0 }, '200-300': { count: 0, sales: 0, qty: 0 }, '300-500': { count: 0, sales: 0, qty: 0 }, '500+': { count: 0, sales: 0, qty: 0 } }
      const packStats = {}

      nitrileProducts.forEach(p => {
        const name = (p.name || '').toLowerCase()
        const price = p.price || 0
        
        if (name.includes('черн') || name.includes('black')) colorStats['黑色'] = (colorStats['黑色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('голуб') || name.includes('син') || name.includes('blue')) colorStats['蓝色'] = (colorStats['蓝色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('бел') || name.includes('white')) colorStats['白色'] = (colorStats['白色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('сер') || name.includes('gray')) colorStats['灰色'] = (colorStats['灰色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('бежев') || name.includes('beige')) colorStats['米色'] = (colorStats['米色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('фиолет') || name.includes('purple')) colorStats['紫色'] = (colorStats['紫色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('розов') || name.includes('pink')) colorStats['粉色'] = (colorStats['粉色'] || { count: 0, sales: 0, qty: 0 })
        else if (name.includes('зелен') || name.includes('green')) colorStats['绿色'] = (colorStats['绿色'] || { count: 0, sales: 0, qty: 0 })
        else colorStats['其他/未标注'] = (colorStats['其他/未标注'] || { count: 0, sales: 0, qty: 0 })
        
        const colorKey = Object.keys(colorStats).find(k => name.includes(k.toLowerCase()) || (k === '黑色' && (name.includes('черн') || name.includes('black'))) || (k === '蓝色' && (name.includes('голуб') || name.includes('син') || name.includes('blue'))) || (k === '白色' && (name.includes('бел') || name.includes('white'))) || (k === '灰色' && (name.includes('сер') || name.includes('gray'))) || (k === '米色' && (name.includes('бежев') || name.includes('beige'))) || (k === '紫色' && (name.includes('фиолет') || name.includes('purple'))) || (k === '粉色' && (name.includes('розов') || name.includes('pink'))) || (k === '绿色' && (name.includes('зелен') || name.includes('green')))) || '其他/未标注'
        if (colorStats[colorKey]) { colorStats[colorKey].count++; colorStats[colorKey].sales += p.sales; colorStats[colorKey].qty += p.qty }
        
        let sizeKey = '未标注'
        if (name.includes(' xs') || name.includes('размер xs')) sizeKey = 'XS'
        else if (name.includes(' s') || name.includes('размер s') || name.includes('размером s')) sizeKey = 'S'
        else if (name.includes(' m') || name.includes('размер m') || name.includes('размером m')) sizeKey = 'M'
        else if (name.includes(' l') || name.includes('размер l') || name.includes('размером l')) sizeKey = 'L'
        else if (name.includes(' xl') || name.includes('размер xl')) sizeKey = 'XL'
        else if (name.includes('xxl')) sizeKey = 'XXL'
        else if (name.includes('универсальн')) sizeKey = '均码'
        if (!sizeStats[sizeKey]) sizeStats[sizeKey] = { count: 0, sales: 0, qty: 0 }
        sizeStats[sizeKey].count++; sizeStats[sizeKey].sales += p.sales; sizeStats[sizeKey].qty += p.qty
        
        if (name.includes('медицинск') || name.includes('медицин')) { if (!useStats['医疗']) useStats['医疗'] = { count: 0, sales: 0, qty: 0 }; useStats['医疗'].count++; useStats['医疗'].sales += p.sales; useStats['医疗'].qty += p.qty }
        if (name.includes('хозяйственн') || name.includes('хозяйств')) { if (!useStats['家务']) useStats['家务'] = { count: 0, sales: 0, qty: 0 }; useStats['家务'].count++; useStats['家务'].sales += p.sales; useStats['家务'].qty += p.qty }
        if (name.includes('смотров')) { if (!useStats['检查']) useStats['检查'] = { count: 0, sales: 0, qty: 0 }; useStats['检查'].count++; useStats['检查'].sales += p.sales; useStats['检查'].qty += p.qty }
        if (name.includes('хирургическ')) { if (!useStats['外科']) useStats['外科'] = { count: 0, sales: 0, qty: 0 }; useStats['外科'].count++; useStats['外科'].sales += p.sales; useStats['外科'].qty += p.qty }
        if (name.includes('парикмахерск') || name.includes('парикмах')) { if (!useStats['美发']) useStats['美发'] = { count: 0, sales: 0, qty: 0 }; useStats['美发'].count++; useStats['美发'].sales += p.sales; useStats['美发'].qty += p.qty }
        if (name.includes('косметическ') || name.includes('космет')) { if (!useStats['美容']) useStats['美容'] = { count: 0, sales: 0, qty: 0 }; useStats['美容'].count++; useStats['美容'].sales += p.sales; useStats['美容'].qty += p.qty }
        if (name.includes('садов') || name.includes('сад')) { if (!useStats['园艺']) useStats['园艺'] = { count: 0, sales: 0, qty: 0 }; useStats['园艺'].count++; useStats['园艺'].sales += p.sales; useStats['园艺'].qty += p.qty }
        if (name.includes('уборк')) { if (!useStats['清洁']) useStats['清洁'] = { count: 0, sales: 0, qty: 0 }; useStats['清洁'].count++; useStats['清洁'].sales += p.sales; useStats['清洁'].qty += p.qty }
        if (name.includes('одноразов')) { if (!useStats['一次性']) useStats['一次性'] = { count: 0, sales: 0, qty: 0 }; useStats['一次性'].count++; useStats['一次性'].sales += p.sales; useStats['一次性'].qty += p.qty }
        if (name.includes('многоразов')) { if (!useStats['可重复使用']) useStats['可重复使用'] = { count: 0, sales: 0, qty: 0 }; useStats['可重复使用'].count++; useStats['可重复使用'].sales += p.sales; useStats['可重复使用'].qty += p.qty }
        
        const brand = p.brand || '未知'
        if (!brandStatsLocal[brand]) brandStatsLocal[brand] = { count: 0, sales: 0, qty: 0 }
        brandStatsLocal[brand].count++; brandStatsLocal[brand].sales += p.sales; brandStatsLocal[brand].qty += p.qty
        
        if (price > 0 && price <= 100) { priceRangeStats['0-100'].count++; priceRangeStats['0-100'].sales += p.sales; priceRangeStats['0-100'].qty += p.qty }
        else if (price > 100 && price <= 200) { priceRangeStats['100-200'].count++; priceRangeStats['100-200'].sales += p.sales; priceRangeStats['100-200'].qty += p.qty }
        else if (price > 200 && price <= 300) { priceRangeStats['200-300'].count++; priceRangeStats['200-300'].sales += p.sales; priceRangeStats['200-300'].qty += p.qty }
        else if (price > 300 && price <= 500) { priceRangeStats['300-500'].count++; priceRangeStats['300-500'].sales += p.sales; priceRangeStats['300-500'].qty += p.qty }
        else if (price > 500) { priceRangeStats['500+'].count++; priceRangeStats['500+'].sales += p.sales; priceRangeStats['500+'].qty += p.qty }
        
        const packMatch = name.match(/(\d+)\s*(шт|пар)/)
        if (packMatch) {
          const rawQty = parseInt(packMatch[1])
          const qty = packMatch[2] === 'пар' ? rawQty * 2 : rawQty
          let packKey = '其他'
          if (qty <= 10) packKey = '1-10只'
          else if (qty <= 50) packKey = '11-50只'
          else if (qty <= 100) packKey = '51-100只'
          else if (qty <= 200) packKey = '101-200只'
          else packKey = '200只+'
          if (!packStats[packKey]) packStats[packKey] = { count: 0, sales: 0, qty: 0 }
          packStats[packKey].count++; packStats[packKey].sales += p.sales; packStats[packKey].qty += p.qty
        }
      })

      const totalNitrileSales = nitrileProducts.reduce((s, p) => s + p.sales, 0)
      const totalNitrileQty = nitrileProducts.reduce((s, p) => s + p.qty, 0)
      const avgNitrilePrice = nitrileProducts.filter(p => p.price > 0).length > 0 
        ? nitrileProducts.filter(p => p.price > 0).reduce((s, p) => s + p.price, 0) / nitrileProducts.filter(p => p.price > 0).length 
        : 0

      const colorData = Object.entries(colorStats).map(([name, d]) => ({ name, ...d, share: (d.qty / totalNitrileQty * 100).toFixed(1) })).sort((a, b) => b.qty - a.qty)
      const sizeData = Object.entries(sizeStats).map(([name, d]) => ({ name, ...d, share: (d.qty / totalNitrileQty * 100).toFixed(1) })).sort((a, b) => b.qty - a.qty)
      const useData = Object.entries(useStats).map(([name, d]) => ({ name, ...d, share: (d.qty / totalNitrileQty * 100).toFixed(1) })).sort((a, b) => b.qty - a.qty)
      const brandData = Object.entries(brandStatsLocal).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.sales - a.sales).slice(0, 10)
      const priceData = Object.entries(priceRangeStats).map(([name, d]) => ({ name, ...d, avgPrice: d.qty > 0 ? d.sales / d.qty : 0 }))
      const packData = Object.entries(packStats).map(([name, d]) => ({ name, ...d, share: (d.qty / totalNitrileQty * 100).toFixed(1) })).sort((a, b) => b.qty - a.qty)

      const getColor = (name) => {
        if (/черн|black/i.test(name)) return '黑色'
        if (/голуб|син|blue/i.test(name)) return '蓝色'
        if (/бел|white/i.test(name)) return '白色'
        if (/сер|gray/i.test(name)) return '灰色'
        if (/бежев|beige/i.test(name)) return '米色'
        if (/фиолет|purple/i.test(name)) return '紫色'
        if (/розов|pink/i.test(name)) return '粉色'
        if (/зелен|green/i.test(name)) return '绿色'
        return null
      }
      const getSize = (name) => {
        if (/xs/i.test(name)) return 'XS'
        if (/(?<![a-z])s(?![a-z])|размер\s*s|размером\s*s/i.test(name)) return 'S'
        if (/(?<![a-z])m(?![a-z])|размер\s*m|размером\s*m/i.test(name)) return 'M'
        if (/(?<![a-z])l(?![a-z])|размер\s*l|размером\s*l/i.test(name)) return 'L'
        if (/xl/i.test(name)) return 'XL'
        if (/xxl/i.test(name)) return 'XXL'
        if (/универсальн/i.test(name)) return '均码'
        return null
      }
      const getPack = (name) => {
        const m = name.match(/(\d+)\s*(шт|пар)/)
        if (m) {
          const num = parseInt(m[1])
          const total = m[2] === 'пар' ? num * 2 : num
          return `${total}只`
        }
        return null
      }
      const getUse = (name) => {
        if (/медицинск|медицин/i.test(name)) return '医疗'
        if (/хозяйственн|хозяйств/i.test(name)) return '家务'
        if (/смотров/i.test(name)) return '检查'
        if (/хирургическ/i.test(name)) return '外科'
        if (/парикмахерск|парикмах/i.test(name)) return '美发'
        if (/косметическ|космет/i.test(name)) return '美容'
        if (/садов|сад/i.test(name)) return '园艺'
        if (/уборк/i.test(name)) return '清洁'
        if (/одноразов/i.test(name)) return '一次性'
        if (/многоразов/i.test(name)) return '可重复使用'
        return null
      }
      const getShipType = (name) => {
        const lower = name.toLowerCase()
        if (/\bfbo\b/i.test(lower)) return 'FBO'
        if (/\bfbs\b/i.test(lower)) return 'FBS'
        if (/野派|fbo|fbs/i.test(name)) {
          if (/fbs/i.test(name)) return 'FBS'
          if (/fbo/i.test(name)) return 'FBO'
        }
        return null
      }
      const getGrossRate = (price) => {
        const refPrice = 1.5
        if (price < refPrice) return null
        return ((price - refPrice) / price * 100).toFixed(1)
      }

      const getPieceCount = (name) => {
        const m = name.match(/(\d+)\s*(шт|пар)/)
        if (m) {
          const num = parseInt(m[1])
          return m[2] === 'пар' ? num * 2 : num
        }
        return null
      }

      const topProducts = [...nitrileProducts].sort((a, b) => b.qty - a.qty).slice(0, 10).map(p => {
        const name = (p.name || '').toLowerCase()
        const pieceCount = getPieceCount(name)
        return {
          ...p,
          _color: getColor(p.name || ''),
          _size: getSize(p.name || ''),
          _pack: getPack(name),
          _pieceCount: pieceCount,
          _pricePerPiece: pieceCount && p.price > 0 ? (p.price / pieceCount).toFixed(1) : null,
          _use: getUse(p.name || ''),
          _shipType: getShipType(p.name || ''),
          _grossRate: getGrossRate(p.price),
        }
      })

      const OUR_COST = { purchase: 38, logistics: 20, ozonRate: 0.12, adRate: 0.10, exchangeLoss: 0.01, afterSales: 0.03, weight: 8.5 }
      const OUR_ACTUAL_PRICE_50 = 851
      const OUR_ACTUAL_PRICE_100 = 2120

      const top100Products = topProducts.filter(p => p._pieceCount === 100)
      const compBase = top100Products.length >= 3 ? top100Products : topProducts.filter(p => p._pieceCount && p._pieceCount >= 80 && p._pieceCount <= 120)
      const compProducts = compBase.length >= 3 ? compBase : topProducts

      const top10AvgPrice = compProducts.length > 0 ? compProducts.reduce((s, p) => s + (p.price || 0), 0) / compProducts.length : 0
      const top10MaxPrice = compProducts.length > 0 ? Math.max(...compProducts.map(p => p.price || 0)) : 0
      const top10MinPrice = compProducts.length > 0 ? Math.min(...compProducts.filter(p => p.price > 0).map(p => p.price || Infinity)) : 0
      const top10AvgQty = compProducts.length > 0 ? compProducts.reduce((s, p) => s + (p.qty || 0), 0) / compProducts.length : 0
      const top10Colors = [...new Set(compProducts.map(p => p._color).filter(Boolean))]
      const top10Sizes = [...new Set(compProducts.map(p => p._size).filter(Boolean))]
      const top10Packs = [...new Set(compProducts.map(p => p._pack).filter(Boolean))]
      const top10FboRatio = compProducts.filter(p => p._shipType === 'FBO').length / compProducts.length * 100
      const top10FbsRatio = compProducts.filter(p => p._shipType === 'FBS').length / compProducts.length * 100
      const top10GrossRates = compProducts.map(p => parseFloat(p._grossRate || 0)).filter(r => r > 0)
      const top10AvgGross = top10GrossRates.length > 0 ? top10GrossRates.reduce((s, r) => s + r, 0) / top10GrossRates.length : 0

      const calcProfit = (priceRub, purchaseCNY, logisticsCNY) => {
        const revenue = priceRub * R
        const ozonFee = priceRub * OUR_COST.ozonRate * R
        const adFee = priceRub * OUR_COST.adRate * R
        const exchangeLoss = priceRub * OUR_COST.exchangeLoss * R
        const afterSalesCost = priceRub * OUR_COST.afterSales * R
        const totalCost = purchaseCNY + ozonFee + adFee + exchangeLoss + afterSalesCost + logisticsCNY
        const profit = revenue - totalCost
        const rate = revenue > 0 ? (profit / revenue * 100) : 0
        return { profit, rate, ozonFee, adFee, exchangeLoss, afterSalesCost, totalCost, revenue }
      }

      const profit50 = calcProfit(OUR_ACTUAL_PRICE_50, OUR_COST.purchase / 2, OUR_COST.logistics * 3 / 5)
      const profit100 = calcProfit(OUR_ACTUAL_PRICE_100, OUR_COST.purchase, OUR_COST.logistics)
      const profitAtAvg = calcProfit(top10AvgPrice, OUR_COST.purchase, OUR_COST.logistics)

      const ozonFee50 = Math.round(OUR_ACTUAL_PRICE_50 * OUR_COST.ozonRate)
      const adFee50 = Math.round(OUR_ACTUAL_PRICE_50 * OUR_COST.adRate)
      const exchangeLoss50 = Math.round(OUR_ACTUAL_PRICE_50 * OUR_COST.exchangeLoss)
      const afterSales50 = Math.round(OUR_ACTUAL_PRICE_50 * OUR_COST.afterSales)
      const ozonFee100 = Math.round(OUR_ACTUAL_PRICE_100 * OUR_COST.ozonRate)
      const adFee100 = Math.round(OUR_ACTUAL_PRICE_100 * OUR_COST.adRate)
      const exchangeLoss100 = Math.round(OUR_ACTUAL_PRICE_100 * OUR_COST.exchangeLoss)
      const afterSales100 = Math.round(OUR_ACTUAL_PRICE_100 * OUR_COST.afterSales)

      const top10ColorCount = top10Colors.length
      const top10SizeCount = top10Sizes.length
      const top10AvgPieceCount = compProducts.filter(p => p._pieceCount).length > 0
        ? compProducts.filter(p => p._pieceCount).reduce((s, p) => s + p._pieceCount, 0) / compProducts.filter(p => p._pieceCount).length
        : 0
      const top10AvgPricePerPiece = compProducts.filter(p => p._pricePerPiece).length > 0
        ? compProducts.filter(p => p._pricePerPiece).reduce((s, p) => s + parseFloat(p._pricePerPiece), 0) / compProducts.filter(p => p._pricePerPiece).length
        : 0
      const ourPricePerPiece100 = OUR_ACTUAL_PRICE_100 / 100

      const radarData = [
        {
          subject: '产品质量',
          us: 95,
          avg: Math.min(70, Math.round(50 + (top10AvgPieceCount < 6 ? 10 : 0) + (top10AvgGross < 15 ? 5 : 10))),
          fullMark: 100,
          usNote: '8.5g高克重重型防滑',
          avgNote: `市场均重${top10AvgPieceCount > 0 ? top10AvgPieceCount.toFixed(1) + 'g' : '5-6g'}`
        },
        {
          subject: '价格竞争力',
          us: Math.round(Math.max(30, 100 - (ourPricePerPiece100 / Math.max(top10AvgPricePerPiece, 0.1) - 1) * 50)),
          avg: 65,
          fullMark: 100,
          usNote: `₽${ourPricePerPiece100.toFixed(1)}/只`,
          avgNote: `₽${top10AvgPricePerPiece.toFixed(1)}/只`
        },
        {
          subject: '利润空间',
          us: Math.min(95, Math.max(20, Math.round(profit100.rate * 2 + 30))),
          avg: Math.min(80, Math.max(20, Math.round(parseFloat(top10AvgGross) * 3 + 25))),
          fullMark: 100,
          usNote: `净利率${profit100.rate.toFixed(1)}%`,
          avgNote: `净利率${top10AvgGross.toFixed(1)}%`
        },
        {
          subject: '供货稳定性',
          us: 90,
          avg: 70,
          fullMark: 100,
          usNote: '国内采购稳定',
          avgNote: '依赖本地供应'
        },
        {
          subject: '包装体验',
          us: 85,
          avg: Math.min(70, 50 + top10ColorCount * 3 + top10SizeCount * 3),
          fullMark: 100,
          usNote: '双面防滑+高克重',
          avgNote: `${top10ColorCount}色${top10SizeCount}码`
        },
        {
          subject: '合规认证',
          us: 80,
          avg: 55,
          fullMark: 100,
          usNote: '无乳胶认证',
          avgNote: '认证参差不齐'
        },
        {
          subject: '品牌故事',
          us: 65,
          avg: Math.min(75, 45 + Math.round(top10AvgQty / 500)),
          fullMark: 100,
          usNote: '重型防滑手套专家',
          avgNote: `TOP10均销${Math.round(top10AvgQty)}件`
        },
        {
          subject: '市场熟悉度',
          us: 50,
          avg: Math.min(85, 55 + Math.round(top10AvgQty / 300)),
          fullMark: 100,
          usNote: '新入局者',
          avgNote: `已验证市场`
        },
      ]

      competitorAnalysis = {
        top10AvgPrice: Math.round(top10AvgPrice),
        top10MaxPrice: Math.round(top10MaxPrice),
        top10MinPrice: Math.round(top10MinPrice),
        top10AvgQty: Math.round(top10AvgQty),
        top10Colors,
        top10Sizes,
        top10Packs,
        top10FboRatio: top10FboRatio.toFixed(0),
        top10FbsRatio: top10FbsRatio.toFixed(0),
        top10AvgGross: top10AvgGross.toFixed(1),
        top10AvgPricePerPiece: top10AvgPricePerPiece.toFixed(1),
        ourPrice50: OUR_ACTUAL_PRICE_50,
        ourPrice100: OUR_ACTUAL_PRICE_100,
        ourPurchase50: OUR_COST.purchase / 2,
        ourPurchase100: OUR_COST.purchase,
        ourLogistics50: OUR_COST.logistics * 3 / 5,
        ourLogistics100: OUR_COST.logistics,
        profit50: profit50.profit.toFixed(2),
        profitRate50: profit50.rate.toFixed(1),
        profit100: profit100.profit.toFixed(2),
        profitRate100: profit100.rate.toFixed(1),
        profitAtAvg: profitAtAvg.profit.toFixed(2),
        profitRateAtAvg: profitAtAvg.rate.toFixed(1),
        ozonFee50,
        adFee50,
        exchangeLoss50,
        afterSales50,
        ozonFee100,
        adFee100,
        exchangeLoss100,
        afterSales100,
        ourCostCNY: OUR_COST.purchase,
        ourLogistics: OUR_COST.logistics,
        ourWeight: OUR_COST.weight,
        ourColor: '黑色/橙色',
        ourSize: 'M码',
        compProductCount: compProducts.length,
        compIs100pcs: top100Products.length >= 3,
        radarData,
      }

      return {
        total: nitrileProducts.length,
        totalSales: totalNitrileSales,
        totalQty: totalNitrileQty,
        avgPrice: avgNitrilePrice,
        shareOfCategory: (nitrileProducts.length / products.length * 100).toFixed(1),
        colorData,
        sizeData,
        useData,
        brandData,
        priceData,
        packData,
        topProducts
      }
    })()

    return {
      totalSales, totalSalesCNY: totalSales * R, totalQty, totalExposure, totalClicks,
      totalAdCost, totalAdCostCNY: totalAdCost * R, avgGross, avgCartRate, avgPrice,
      productCount: data.length, brandCount: Object.keys(brandStats).length,
      topCategory: topCatName,
      dictionary,
      topBrands, shippingData, fbsFboChartData, priceData, featureData, topProducts, fbsTopProducts,
      highPotential, vacuumZone, adEfficiency, noAdHighSales, priceElasticity, priceBandFeatureData,
      newProducts180, newProductsStats, priceScatterAnalysis, operationStrategy,
      avgClickRate: totalExposure > 0 ? (totalClicks / totalExposure * 100).toFixed(2) : '0',
      avgAdRatio: products.reduce((s, p) => s + p.adRatio, 0) / products.length,
      marketConcentration, hhi, marketPower, brandPower, underservedPrices, seasonalData, seasonalAdvice,
      isPillowCategory, sizeMaterialData,
      isHairCareCategory, ingredientData,
      isHairMaskCategory, hairMaskAnalysis,
      isSprayCategory, sprayAnalysis,
      isGlovesCategory, nitrileGlovesData, competitorAnalysis
    }
  }, [data])

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="text-6xl mb-6">📊</div>
          <h2 className="text-2xl font-semibold text-morandi-text mb-3">新版市场分析面板</h2>
          <p className="text-morandi-text-light">请上传Ozon分析报告数据开始分析</p>
        </div>
      </div>
    )
  }

  const CC = ['#8B9DC3', '#B4BEC9', '#C3B4D1', '#D4C4B0', '#E8D5C4', '#F0E6E0', '#D9E5D6', '#A8C5DA']

  const exportSprayStockPDF = async () => {
    setSprayExporting(true)
    try {
      const element = sprayStockRef.current
      if (!element) { setSprayExporting(false); return }
      const canvas = await html2canvas(element, { scale: 3, useCORS: true, logging: false, backgroundColor: '#ffffff' })
      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight])
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save('精油喷雾备货计算.pdf')
    } catch (err) { console.error('Export error:', err); alert('导出失败') }
    finally { setSprayExporting(false) }
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-morandi-primary to-morandi-secondary rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">📊 Ozon电商市场深度分析</h1>
        <p className="opacity-90">所属类目: {stats.topCategory} | 数据维度: {data.length} 个商品 | {stats.brandCount} 个品牌 | 报告日期: {new Date().toLocaleDateString('zh-CN')} | 汇率: 1₽=¥0.09</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KPICard icon={<DollarSign className="w-5 h-5" />} title="总销售额" value={`¥${fmtCNY(stats.totalSales)}`} sub={`₽${fmtCNY(stats.totalSales / R)}`} trend={stats.totalSales > 50000000 ? 'up' : 'neutral'} />
        <KPICard icon={<Package className="w-5 h-5" />} title="总销量" value={stats.totalQty.toLocaleString()} sub={`${stats.productCount}个商品`} trend="up" />
        <KPICard icon={<Eye className="w-5 h-5" />} title="曝光量" value={stats.totalExposure.toLocaleString()} sub={`CTR ${stats.avgClickRate}%`} trend="neutral" />
        <KPICard icon={<Target className="w-5 h-5" />} title="广告投入" value={`¥${fmtCNY(stats.totalAdCost)}`} sub={`₽${fmtCNY(stats.totalAdCost / R)}`} trend={stats.totalAdCost > 100000 ? 'down' : 'neutral'} />
        <KPICard icon={<Percent className="w-5 h-5" />} title="平均毛利率" value={stats.avgGross != null && stats.avgGross > 0 ? `${stats.avgGross.toFixed(1)}%` : '未知'} sub="预估毛利率" trend={stats.avgGross != null && stats.avgGross > 30 ? 'up' : 'neutral'} />
        <KPICard icon={<ShoppingCart className="w-5 h-5" />} title="加购率" value={`${stats.avgCartRate?.toFixed(2)}%`} sub="购物车转化" trend="neutral" />
        <KPICard icon={<BarChart3 className="w-5 h-5" />} title="平均客单价" value={`¥${Math.round(stats.avgPrice * R).toLocaleString()}`} sub={`₽${Math.round(stats.avgPrice).toLocaleString()}`} trend="neutral" />
        <KPICard icon={<Crown className="w-5 h-5" />} title="市场集中度" value={`${stats.marketConcentration?.toFixed(0)}%`} sub="Top3品牌占比" trend={stats.marketConcentration > 50 ? 'down' : 'up'} />
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4">🌡️ 俄罗斯电商市场季节销量波动</h3>
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.seasonalData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `¥${v}`} tick={{ fontSize: 10 }} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div className="bg-white p-3 shadow-lg rounded-lg text-xs border">
                      <p className="font-medium mb-1">{d?.month}</p>
                      <p className="text-blue-600">销量指数: {d?.salesIndex}%</p>
                      <p className="text-orange-600">均价(¥): {Math.round(d?.avgPrice).toLocaleString()}</p>
                      <p className="text-green-600">搜索热度: {d?.searchIndex}%</p>
                      <p className="text-purple-600 mt-1 font-medium">{d?.insight}</p>
                    </div>
                  )
                }} />
                <Line yAxisId="left" type="monotone" dataKey="salesIndex" stroke="#8B9DC3" strokeWidth={2.5} dot={{ r: 4, fill: '#8B9DC3' }} name="销量指数" />
                <Line yAxisId="left" type="monotone" dataKey="searchIndex" stroke="#4CAF50" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#4CAF50' }} name="搜索热度" />
                <Line yAxisId="right" type="monotone" dataKey="avgPrice" stroke="#FF9800" strokeWidth={2} dot={{ r: 3, fill: '#FF9800' }} name="均价(¥)" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2 text-xs text-morandi-text-light">
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#8B9DC3] inline-block"></span> 销量指数</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#4CAF50] inline-block border-dashed"></span> 搜索热度</span>
              <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-[#FF9800] inline-block"></span> 均价(¥)</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-xs text-red-500 font-medium mb-1">🔥 旺季 ({stats.seasonalAdvice?.peak?.months || '10月-2月'})</div>
              <div className="text-xs text-red-600">{stats.seasonalAdvice?.peak?.text || '黑五/圣诞/新年促销叠加，销量可达淡季2-3倍'}</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-blue-500 font-medium mb-1">❄️ 平季 ({stats.seasonalAdvice?.shoulder?.months || '3月-5月'})</div>
              <div className="text-xs text-blue-600">{stats.seasonalAdvice?.shoulder?.text || '春季需求回落但仍稳定，适合新品上架测试市场反应'}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 font-medium mb-1">📉 淡季 ({stats.seasonalAdvice?.low?.months || '6月-9月'})</div>
              <div className="text-xs text-gray-600">{stats.seasonalAdvice?.low?.text || '夏季需求最低，但细分品类仍有小高峰'}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-xs text-green-600 font-medium mb-1">💡 进入时机建议</div>
              <div className="text-xs text-green-700">{stats.seasonalAdvice?.entry || '建议旺季前2个月备货入仓，旺季前1个月启动广告，旺季首月冲刺销量'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Crown className="w-5 h-5 text-morandi-primary" /> 品牌销售额TOP10</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={stats.topBrands} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" tickFormatter={(v) => `¥${fmtCNY(v)}`} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`¥${fmtCNYFull(v)}`, '销售额']} />
              <Bar dataKey="sales" fill="#8B9DC3" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-morandi-primary" /> 发货模式分布</h3>
          {stats.shippingData.filter(d => d.name !== '未知').length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={stats.shippingData.filter(d => d.name !== '未知')} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2} dataKey="count" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {stats.shippingData.filter(d => d.name !== '未知').map((_, i) => <Cell key={i} fill={CC[i % CC.length]} />)}
              </Pie>
              <Tooltip formatter={(v, n) => n === 'qty' ? `${v}个` : `${v}款`} />
            </PieChart>
          </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-morandi-text-light">
              <div className="text-center">
                <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">当前数据不含发货模式信息</p>
                <p className="text-xs mt-1">上传包含FBO/FBS字段的数据可查看分布</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-morandi-primary" /> FBS vs FBO 发货方式销量对比</h3>
        {stats.fbsFboChartData.length > 0 ? (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.fbsFboChartData} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `¥${fmtCNY(v)}`} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v, n) => n === '销量' || n === 'qty' ? `${Math.round(v).toLocaleString()}个` : `¥${fmtCNYFull(v)}`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="qty" fill="#8B9DC3" name="销量" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="sales" fill="#D4C4B0" name="销售额" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {stats.fbsFboChartData.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-3 h-3 rounded-full ${i === 0 ? 'bg-[#8B9DC3]' : i === 1 ? 'bg-[#D4C4B0]' : 'bg-[#C3B4D1]'}`}></span>
                  <span className="text-sm font-medium text-morandi-text">{item.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-morandi-text-light">销量:</span> <strong>{item.qty.toLocaleString()}</strong></div>
                  <div><span className="text-morandi-text-light">销售额:</span> <strong>¥{fmtCNYFull(item.sales)}</strong></div>
                  <div><span className="text-morandi-text-light">商品数:</span> <strong>{item.count}</strong></div>
                  <div><span className="text-morandi-text-light">均价:</span> <strong>¥{Math.round(item.avgPrice * R).toLocaleString()}</strong></div>
                </div>
              </div>
            ))}
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-xs text-blue-600 font-medium mb-1">💡 发货方式建议</div>
              <div className="text-xs text-blue-700">
                {stats.fbsFboChartData.length > 0 && (() => {
                  const top = [...stats.fbsFboChartData].sort((a, b) => b.qty - a.qty)[0]
                  return `${top.name}模式销量最高，建议新卖家优先选择${top.name}以获取更多流量`
                })()}
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-morandi-text-light">
            <div className="text-center">
              <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">当前数据不含FBO/FBS发货模式信息</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">💰 价格带分布与市场竞争</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.priceData}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis yAxisId="left" tickFormatter={(v) => `¥${fmtCNY(v)}`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}个`} />
              <Tooltip formatter={(v, n) => n === 'count' ? `${v}个` : `¥${fmtCNYFull(v)}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="sales" fill="#8B9DC3" name="销售额" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="count" fill="#D4C4B0" name="产品数" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">价格带</th><th className="px-2 py-2 text-right">商品数</th><th className="px-2 py-2 text-right">占比</th><th className="px-2 py-2 text-right">总销售额(¥)</th><th className="px-2 py-2 text-right">平均价格(¥)</th><th className="px-2 py-2 text-right">平均日销</th></tr></thead>
              <tbody>
                {stats.priceData.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-2 py-2 font-medium">{p.name}</td>
                    <td className="px-2 py-2 text-right">{p.count}</td>
                    <td className="px-2 py-2 text-right">{(p.count / stats.productCount * 100).toFixed(1)}%</td>
                    <td className="px-2 py-2 text-right font-medium">¥{fmtCNYFull(p.sales)}</td>
                    <td className="px-2 py-2 text-right">¥{fmtCNYFull(p.sales / p.qty || 0)}</td>
                    <td className="px-2 py-2 text-right">{Math.round(p.qty / 30).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">📊 各价格带广告投入分析</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.priceData}>
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis yAxisId="left" tickFormatter={(v) => `¥${fmtCNY(v)}`} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v, n) => n === 'avgAdRatio' ? `${v.toFixed(1)}%` : `¥${fmtCNYFull(v)}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="avgAdCost" fill="#FF9800" name="平均广告费" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="avgAdRatio" fill="#7C4DFF" name="广告占比" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">价格带</th><th className="px-2 py-2 text-right">总广告费(¥)</th><th className="px-2 py-2 text-right">平均广告费(¥)</th><th className="px-2 py-2 text-right">广告占比</th><th className="px-2 py-2 text-right">ROI</th><th className="px-2 py-2 text-left">建议</th></tr></thead>
              <tbody>
                {stats.priceData.map((p, i) => {
                  const r = p.avgAdRatio || 0
                  const roi = p.avgAdCost > 0 && p.avgPrice > 0 ? (p.avgPrice / p.avgAdCost).toFixed(1) : '-'
                  const sug = r > 10 ? '⚠️占比过高' : r > 5 ? '适中' : '✅可增加'
                  return (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-2 py-2 font-medium">{p.name}</td>
                      <td className="px-2 py-2 text-right">¥{fmtCNYFull(p.adCost)}</td>
                      <td className="px-2 py-2 text-right">¥{fmtCNYFull(p.avgAdCost)}</td>
                      <td className="px-2 py-2 text-right"><span className={`px-1 py-0.5 rounded text-xs ${r > 10 ? 'bg-red-100 text-red-700' : r > 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{r.toFixed(2)}%</span></td>
                      <td className="px-2 py-2 text-right font-medium">{roi}</td>
                      <td className="px-2 py-2 text-morandi-text-light">{sug}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {stats.isPillowCategory && stats.sizeMaterialData && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">📐 尺寸与材质统计分析</h3>
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.sizeMaterialData.sizeData.length}</div>
              <div className="text-xs text-blue-600">尺寸规格数</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.sizeMaterialData.materialData.length}</div>
              <div className="text-xs text-green-600">材质类型数</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-purple-700">{stats.sizeMaterialData.topSize}</div>
              <div className="text-xs text-purple-600">最热尺寸</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-orange-700">{stats.sizeMaterialData.topMaterial}</div>
              <div className="text-xs text-orange-600">最热材质</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3 flex items-center gap-2">📏 尺寸分布 <span className="text-xs text-morandi-text-light font-normal">识别率 {stats.sizeMaterialData.sizeCoverage}%</span></h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.sizeMaterialData.sizeData.slice(0, 8)} layout="vertical" margin={{ left: 60 }}>
                  <XAxis type="number" tickFormatter={v => `¥${fmtCNY(v)}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n) => n === 'sales' ? `¥${fmtCNYFull(v)}` : n === 'count' ? `${v}款` : v} />
                  <Bar dataKey="sales" fill="#8B9DC3" name="销售额" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">尺寸(cm)</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">占比</th><th className="px-2 py-1 text-right">销售额(¥)</th><th className="px-2 py-1 text-right">均价(¥)</th></tr></thead>
                  <tbody>
                    {stats.sizeMaterialData.sizeData.slice(0, showAllSizes ? undefined : 10).map((s, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{s.name}</td>
                        <td className="px-2 py-1 text-right">{s.count}</td>
                        <td className="px-2 py-1 text-right">{s.share}%</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(s.sales)}</td>
                        <td className="px-2 py-1 text-right">¥{Math.round(s.avgPrice * R).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stats.sizeMaterialData.sizeData.length > 10 && (
                  <button onClick={() => setShowAllSizes(!showAllSizes)} className="mt-2 w-full text-center text-xs text-morandi-primary hover:underline py-1">
                    {showAllSizes ? '收起' : `展开全部 ${stats.sizeMaterialData.sizeData.length} 个尺寸`}
                  </button>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3 flex items-center gap-2">🧵 材质分布 <span className="text-xs text-morandi-text-light font-normal">识别率 {stats.sizeMaterialData.materialCoverage}%</span></h4>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={stats.sizeMaterialData.materialData} cx="50%" cy="50%" innerRadius={50} outerRadius={95} paddingAngle={2} dataKey="count" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {stats.sizeMaterialData.materialData.map((_, i) => <Cell key={i} fill={CC[i % CC.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [`${v}款 (¥${fmtCNYFull(p.payload.sales)})`, p.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">材质</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">占比</th><th className="px-2 py-1 text-right">销售额(¥)</th><th className="px-2 py-1 text-right">均价(¥)</th></tr></thead>
                  <tbody>
                    {stats.sizeMaterialData.materialData.slice(0, showAllMaterials ? undefined : 10).map((m, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{m.name}</td>
                        <td className="px-2 py-1 text-right">{m.count}</td>
                        <td className="px-2 py-1 text-right">{m.share}%</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(m.sales)}</td>
                        <td className="px-2 py-1 text-right">¥{Math.round(m.avgPrice * R).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stats.sizeMaterialData.materialData.length > 10 && (
                  <button onClick={() => setShowAllMaterials(!showAllMaterials)} className="mt-2 w-full text-center text-xs text-morandi-primary hover:underline py-1">
                    {showAllMaterials ? '收起' : `展开全部 ${stats.sizeMaterialData.materialData.length} 种材质`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {stats.sizeMaterialData.crossData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🔗 尺寸×材质交叉分析 (TOP组合)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">排名</th><th className="px-2 py-1 text-left">尺寸(cm)</th><th className="px-2 py-1 text-left">材质</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">销售额(¥)</th><th className="px-2 py-1 text-right">均价(¥)</th><th className="px-2 py-1 text-right">销量</th></tr></thead>
                  <tbody>
                    {stats.sizeMaterialData.crossData.slice(0, 15).map((c, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1"><span className={`inline-block w-5 h-5 rounded-full text-xs text-center leading-5 ${i < 3 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                        <td className="px-2 py-1 font-medium">{c.size}</td>
                        <td className="px-2 py-1"><span className="px-2 py-0.5 bg-morandi-primary/10 text-morandi-primary rounded-full text-xs">{c.material}</span></td>
                        <td className="px-2 py-1 text-right">{c.count}</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(c.sales)}</td>
                        <td className="px-2 py-1 text-right">¥{Math.round(c.avgPrice * R).toLocaleString()}</td>
                        <td className="px-2 py-1 text-right">{c.qty.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 bg-amber-50 rounded-lg p-4">
                <h5 className="text-sm font-semibold text-amber-800 mb-2">💡 尺寸×材质选品建议</h5>
                <div className="text-xs text-amber-700 space-y-1">
                  <p>• 最热组合: <strong>{stats.sizeMaterialData.crossData[0]?.size} + {stats.sizeMaterialData.crossData[0]?.material}</strong>，共{stats.sizeMaterialData.crossData[0]?.count}款商品，销售额¥{fmtCNYFull(stats.sizeMaterialData.crossData[0]?.sales || 0)}</p>
                  {stats.sizeMaterialData.crossData.length > 1 && (
                    <p>• 次热组合: <strong>{stats.sizeMaterialData.crossData[1]?.size} + {stats.sizeMaterialData.crossData[1]?.material}</strong>，共{stats.sizeMaterialData.crossData[1]?.count}款商品</p>
                  )}
                  {(() => {
                    const topCross = stats.sizeMaterialData.crossData[0]
                    const avgAll = stats.totalSales / stats.totalQty
                    const premiumVs = topCross && avgAll > 0 ? ((topCross.avgPrice / avgAll - 1) * 100).toFixed(1) : 0
                    return <p>• 最热组合均价{premiumVs >= 0 ? '高于' : '低于'}市场均价{Math.abs(premiumVs)}%，{premiumVs >= 0 ? '存在溢价空间' : '有价格竞争优势'}</p>
                  })()}
                  {stats.sizeMaterialData.sizeData.length > 0 && (
                    <p>• 尺寸建议: 主推{stats.sizeMaterialData.topSize}规格，{stats.sizeMaterialData.sizeData.length > 1 ? `同时布局${stats.sizeMaterialData.sizeData[1]?.name}差异化规格` : '可考虑拓展其他规格'}</p>
                  )}
                  {stats.sizeMaterialData.materialData.length > 0 && (
                    <p>• 材质建议: 主打{stats.sizeMaterialData.topMaterial}材质，{stats.sizeMaterialData.materialData.length > 1 ? `关注${stats.sizeMaterialData.materialData[1]?.name}等新兴材质趋势` : '可探索更多材质选择'}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {stats.isHairCareCategory && stats.ingredientData && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🧪 成分与功效分析</h3>
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-pink-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-pink-700">{stats.ingredientData.allIngredients.length}</div>
              <div className="text-xs text-pink-600">识别成分数</div>
            </div>
            <div className="bg-violet-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-violet-700">{stats.ingredientData.categoryData.length}</div>
              <div className="text-xs text-violet-600">成分类别数</div>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-rose-700">{stats.ingredientData.topIngredient}</div>
              <div className="text-xs text-rose-600">最热成分</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-amber-700">{stats.ingredientData.topCategory}</div>
              <div className="text-xs text-amber-600">最热类别</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3 flex items-center gap-2">📊 成分类别分布 <span className="text-xs text-morandi-text-light font-normal">识别率 {stats.ingredientData.coverage}%</span></h4>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={stats.ingredientData.categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={2} dataKey="count" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {stats.ingredientData.categoryData.map((_, i) => <Cell key={i} fill={CC[i % CC.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [`${v}款 (¥${fmtCNYFull(p.payload.sales)})`, p.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">类别</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">销售额(¥)</th><th className="px-2 py-1 text-right">均价(¥)</th></tr></thead>
                  <tbody>
                    {stats.ingredientData.categoryData.map((c, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{c.name}</td>
                        <td className="px-2 py-1 text-right">{c.count}</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(c.sales)}</td>
                        <td className="px-2 py-1 text-right">¥{Math.round(c.avgPrice * R).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🏆 热门成分排行 TOP15</h4>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.ingredientData.allIngredients.slice(0, 15)} layout="vertical" margin={{ left: 70 }}>
                  <XAxis type="number" tickFormatter={v => `¥${fmtCNY(v)}`} />
                  <YAxis type="category" dataKey="zh" tick={{ fontSize: 10 }} width={65} />
                  <Tooltip formatter={(v, n) => n === 'sales' ? `¥${fmtCNYFull(v)}` : n === 'count' ? `${v}款` : v} />
                  <Bar dataKey="sales" fill="#D4A5A5" name="销售额" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">成分</th><th className="px-2 py-1 text-left">类别</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">占比</th><th className="px-2 py-1 text-right">销售额(¥)</th></tr></thead>
                  <tbody>
                    {stats.ingredientData.allIngredients.slice(0, 15).map((ing, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{ing.zh}</td>
                        <td className="px-2 py-1"><span className="px-1.5 py-0.5 bg-pink-50 text-pink-700 rounded text-xs">{ing.category}</span></td>
                        <td className="px-2 py-1 text-right">{ing.count}</td>
                        <td className="px-2 py-1 text-right">{ing.share}%</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(ing.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {stats.ingredientData.proteinIngredients.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h5 className="text-xs font-semibold text-blue-800 mb-2">🧬 蛋白质成分</h5>
                <div className="space-y-1">
                  {stats.ingredientData.proteinIngredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-blue-700">{ing.zh}</span>
                      <span className="text-blue-600">{ing.count}款 · {ing.share}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stats.ingredientData.oilIngredients.length > 0 && (
              <div className="bg-amber-50 rounded-lg p-4">
                <h5 className="text-xs font-semibold text-amber-800 mb-2">🫒 油脂成分</h5>
                <div className="space-y-1">
                  {stats.ingredientData.oilIngredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-amber-700">{ing.zh}</span>
                      <span className="text-amber-600">{ing.count}款 · {ing.share}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stats.ingredientData.plantIngredients.length > 0 && (
              <div className="bg-green-50 rounded-lg p-4">
                <h5 className="text-xs font-semibold text-green-800 mb-2">🌿 植物成分</h5>
                <div className="space-y-1">
                  {stats.ingredientData.plantIngredients.map((ing, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-green-700">{ing.zh}</span>
                      <span className="text-green-600">{ing.count}款 · {ing.share}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {stats.ingredientData.effectIngredients.length > 0 && (
            <div className="mb-6 bg-violet-50 rounded-lg p-4">
              <h5 className="text-xs font-semibold text-violet-800 mb-3">✨ 功效成分热度</h5>
              <div className="flex flex-wrap gap-2">
                {stats.ingredientData.effectIngredients.map((ing, i) => {
                  const maxSales = stats.ingredientData.effectIngredients[0]?.sales || 1
                  const intensity = Math.max(0.3, ing.sales / maxSales)
                  return (
                    <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: `rgba(139, 92, 246, ${intensity * 0.3})`, color: `rgba(91, 33, 182, ${0.5 + intensity * 0.5})` }}>
                      {ing.zh} <span className="font-normal">({ing.count}款)</span>
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {stats.ingredientData.hairTypeIngredients.length > 0 && (
            <div className="mb-6 bg-cyan-50 rounded-lg p-4">
              <h5 className="text-xs font-semibold text-cyan-800 mb-3">💇 适用发质分布</h5>
              <div className="flex flex-wrap gap-2">
                {stats.ingredientData.hairTypeIngredients.map((ing, i) => (
                  <span key={i} className="px-3 py-1.5 bg-cyan-100 text-cyan-800 rounded-full text-xs font-medium">
                    {ing.zh} <span className="font-normal">({ing.count}款 · {ing.share}%)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {stats.ingredientData.topPairs.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🔗 成分组合分析 TOP10</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">排名</th><th className="px-2 py-1 text-left">成分组合</th><th className="px-2 py-1 text-right">商品数</th><th className="px-2 py-1 text-right">销售额(¥)</th></tr></thead>
                  <tbody>
                    {stats.ingredientData.topPairs.map((p, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1"><span className={`inline-block w-5 h-5 rounded-full text-xs text-center leading-5 ${i < 3 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                        <td className="px-2 py-1 font-medium">{p.pair}</td>
                        <td className="px-2 py-1 text-right">{p.count}</td>
                        <td className="px-2 py-1 text-right font-medium">¥{fmtCNYFull(p.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="bg-rose-50 rounded-lg p-4">
            <h5 className="text-sm font-semibold text-rose-800 mb-2">💡 成分选品建议</h5>
            <div className="text-xs text-rose-700 space-y-1">
              <p>• 最热成分: <strong>{stats.ingredientData.topIngredient}</strong>，最热类别: <strong>{stats.ingredientData.topCategory}</strong></p>
              {stats.ingredientData.topPairs.length > 0 && (
                <p>• 黄金组合: <strong>{stats.ingredientData.topPairs[0]?.pair}</strong>，共{stats.ingredientData.topPairs[0]?.count}款商品，建议主打此成分搭配</p>
              )}
              {stats.ingredientData.proteinIngredients.length > 0 && stats.ingredientData.oilIngredients.length > 0 && (
                <p>• 蛋白质+油脂组合是高端护发核心卖点，角蛋白+摩洛哥坚果油等搭配溢价能力强</p>
              )}
              {stats.ingredientData.effectIngredients.length > 0 && (
                <p>• 功效宣称: <strong>{stats.ingredientData.effectIngredients.slice(0, 3).map(e => e.zh).join('、')}</strong> 是市场主流功效方向</p>
              )}
              {stats.ingredientData.hairTypeIngredients.length > 0 && (
                <p>• 细分发质: <strong>{stats.ingredientData.hairTypeIngredients[0]?.zh}</strong> 需求最大，可针对性开发专属配方</p>
              )}
              {stats.ingredientData.plantIngredients.length > 0 && (
                <p>• 植物提取趋势: <strong>{stats.ingredientData.plantIngredients[0]?.zh}</strong> 最受欢迎，天然成分是增长点</p>
              )}
            </div>
          </div>
        </div>
      )}

      {stats.isHairMaskCategory && stats.hairMaskAnalysis && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-morandi-text mb-4 flex items-center gap-2">
            <span className="text-2xl">💇‍♀️</span> 发膜专项分析 · 规格与价格
          </h3>

          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-pink-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">发膜产品数</div>
              <div className="text-2xl font-bold text-pink-700">{stats.hairMaskAnalysis.totalProducts}</div>
            </div>
            <div className="bg-violet-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">总销量</div>
              <div className="text-2xl font-bold text-violet-700">{stats.hairMaskAnalysis.totalQty.toLocaleString()}</div>
            </div>
            <div className="bg-rose-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">300g规格均价</div>
              <div className="text-2xl font-bold text-rose-700">₽{stats.hairMaskAnalysis.mask300gAvgPrice}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">竞品对标价</div>
              <div className="text-2xl font-bold text-red-700">₽{stats.hairMaskAnalysis.competitorMask.priceRUB}<span className="text-xs font-normal">/{stats.hairMaskAnalysis.competitorMask.weight}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">📦 规格分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.hairMaskAnalysis.weightData.slice(0, 10)} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [`₽${v}`, name]} />
                  <Bar dataKey="qty" fill="#D4A0B0" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">💰 规格价格区间</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.hairMaskAnalysis.priceByWeightData} margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`₽${v}`, '']} />
                  <Bar dataKey="minPrice" fill="#E8D5C4" name="最低价" />
                  <Bar dataKey="avgPrice" fill="#D4A0B0" name="均价" />
                  <Bar dataKey="maxPrice" fill="#C3B4D1" name="最高价" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">✨ 功效分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.hairMaskAnalysis.effectData.slice(0, 10)} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [v, name]} />
                  <Bar dataKey="qty" fill="#C3B4D1" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🎯 适用发质分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.hairMaskAnalysis.hairTypeData.slice(0, 8)} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [v, name]} />
                  <Bar dataKey="qty" fill="#B4BEC9" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h4 className="text-sm font-semibold text-morandi-text mb-3">🏆 TOP10热销发膜</h4>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">排名</th><th className="px-2 py-2 text-left">商品名称</th><th className="px-2 py-2 text-center">规格</th><th className="px-2 py-2 text-center">功效</th><th className="px-2 py-2 text-center">适用发质</th><th className="px-2 py-2 text-right">单价(₽)</th><th className="px-2 py-2 text-right">每100ml/g(₽)</th><th className="px-2 py-2 text-right">销量</th></tr></thead>
              <tbody>
                {stats.hairMaskAnalysis.top10Products.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-2 py-2 font-bold text-morandi-text">{i + 1}</td>
                    <td className="px-2 py-2 max-w-[200px] truncate" title={p.name}>{p.name}</td>
                    <td className="px-2 py-2 text-center"><span className="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-[10px]">{p._weight || '-'}</span></td>
                    <td className="px-2 py-2 text-center"><span className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded text-[10px]">{p._effects || '-'}</span></td>
                    <td className="px-2 py-2 text-center"><span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px]">{p._hairTypes || '-'}</span></td>
                    <td className="px-2 py-2 text-right font-medium">₽{Math.round(p.price).toLocaleString()}</td>
                    <td className="px-2 py-2 text-right">{p._pricePer100ml ? <span className="text-indigo-600">₽{p._pricePer100ml}</span> : <span className="text-gray-300">-</span>}</td>
                    <td className="px-2 py-2 text-right font-bold">{(p.qty || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-bold text-morandi-text mb-4 flex items-center gap-2">
              <span className="text-lg">🐟</span> 鱼子酱发膜市场定位分析
            </h4>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gradient-to-br from-amber-50 to-pink-50 rounded-lg p-4 border border-amber-100">
                <h5 className="text-xs font-bold text-amber-800 mb-2">🐟 我方产品 · {stats.hairMaskAnalysis.ourMask.positioning}</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-morandi-text-light">规格</span><span className="font-bold">{stats.hairMaskAnalysis.ourMask.weight}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">定价</span><span className="font-bold text-blue-700">₽{stats.hairMaskAnalysis.ourMask.ourPriceRUB} ≈ ¥{(stats.hairMaskAnalysis.ourMask.ourPriceRUB * R).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">采购成本</span><span className="font-bold">¥{stats.hairMaskAnalysis.ourMask.priceCNY}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">物流费</span><span className="font-bold">¥{stats.hairMaskAnalysis.ourMask.logistics}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">每100g</span><span className="font-bold text-blue-600">₽{(stats.hairMaskAnalysis.ourMask.ourPriceRUB / 300 * 100).toFixed(1)}</span></div>
                </div>
                <div className="mt-2 pt-2 border-t border-amber-200">
                  <div className="text-[10px] text-amber-700 space-y-0.5">
                    {stats.hairMaskAnalysis.ourMask.features.map((f, i) => (
                      <div key={i}>✓ {f}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-red-200">
                <h5 className="text-xs font-bold text-red-700 mb-2">🔴 竞品 · 粉色鱼子酱发膜</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-morandi-text-light">规格</span><span className="font-bold">{stats.hairMaskAnalysis.competitorMask.weight}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">售价</span><span className="font-bold text-red-600">₽{stats.hairMaskAnalysis.competitorMask.priceRUB} ≈ ¥{(stats.hairMaskAnalysis.competitorMask.priceRUB * R).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">每100g</span><span className="font-bold text-red-600">₽{(stats.hairMaskAnalysis.competitorMask.priceRUB / 350 * 100).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">定位</span><span className="text-[10px] font-bold text-red-600">重修护·厚膜·强顺滑·沙龙老派</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">适合发质</span><span className="text-[10px]">粗硬发/干枯炸毛发</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">核心短板</span><span className="text-[10px] text-red-600">含DMDM甲醛释放体+Parabens</span></div>
                </div>
                <div className="mt-2 pt-2 border-t border-red-200">
                  <div className="text-[10px] text-red-600 space-y-0.5">
                    <div>❌ DMDM Hydantoin（甲醛释放体）</div>
                    <div>❌ Methylparaben / Propylparaben（防腐酯）</div>
                    <div>⚠️ 易塌发/油腻/头皮负担大</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-lg p-3 border border-green-100">
                <h5 className="text-xs font-bold text-green-700 mb-2">💰 利润测算</h5>
                <div className="space-y-1 text-xs border-b border-gray-100 pb-2 mb-2">
                  <div className="text-[10px] font-bold text-blue-600">方案A：竞品对标价₽{stats.hairMaskAnalysis.competitorMask.priceRUB}</div>
                  <div className="flex justify-between"><span>售价</span><span className="font-bold">₽{stats.hairMaskAnalysis.competitorMask.priceRUB} ≈ ¥{(stats.hairMaskAnalysis.competitorMask.priceRUB * R).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span>采购+物流</span><span className="text-red-500">-¥{stats.hairMaskAnalysis.ourMask.priceCNY} -¥{stats.hairMaskAnalysis.ourMask.logistics}</span></div>
                  <div className="flex justify-between"><span>平台运营费(26%)</span><span className="text-red-500">-₽{Math.round(stats.hairMaskAnalysis.competitorMask.priceRUB * 0.26)} ≈ -¥{(stats.hairMaskAnalysis.competitorMask.priceRUB * 0.26 * R).toFixed(1)}</span></div>
                  <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span>净利润/单</span><span className={stats.hairMaskAnalysis.profitAtCompetitor.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{stats.hairMaskAnalysis.profitAtCompetitor.profit.toFixed(2)}（{stats.hairMaskAnalysis.profitAtCompetitor.rate.toFixed(1)}%）</span></div>
                </div>
                <div className="space-y-1 text-xs border-b border-gray-100 pb-2 mb-2">
                  <div className="text-[10px] font-bold text-green-600">方案B：我方定价₽{stats.hairMaskAnalysis.ourMask.ourPriceRUB}（溢价{Math.round((stats.hairMaskAnalysis.ourMask.ourPriceRUB / stats.hairMaskAnalysis.competitorMask.priceRUB - 1) * 100)}%，突出温和高端）</div>
                  <div className="flex justify-between"><span>售价</span><span className="font-bold">₽{stats.hairMaskAnalysis.ourMask.ourPriceRUB} ≈ ¥{(stats.hairMaskAnalysis.ourMask.ourPriceRUB * R).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span>采购+物流</span><span className="text-red-500">-¥{stats.hairMaskAnalysis.ourMask.priceCNY} -¥{stats.hairMaskAnalysis.ourMask.logistics}</span></div>
                  <div className="flex justify-between"><span>平台运营费(26%)</span><span className="text-red-500">-₽{Math.round(stats.hairMaskAnalysis.ourMask.ourPriceRUB * 0.26)} ≈ -¥{(stats.hairMaskAnalysis.ourMask.ourPriceRUB * 0.26 * R).toFixed(1)}</span></div>
                  <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span>净利润/单</span><span className={stats.hairMaskAnalysis.profitAtOurPrice.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{stats.hairMaskAnalysis.profitAtOurPrice.profit.toFixed(2)}（{stats.hairMaskAnalysis.profitAtOurPrice.rate.toFixed(1)}%）</span></div>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="text-[10px] font-bold text-gray-500">按300g规格均价 ₽{stats.hairMaskAnalysis.mask300gAvgPrice}</div>
                  <div className="flex justify-between"><span>售价</span><span className="font-bold">₽{stats.hairMaskAnalysis.mask300gAvgPrice} ≈ ¥{(stats.hairMaskAnalysis.mask300gAvgPrice * R).toFixed(1)}</span></div>
                  <div className="flex justify-between"><span>采购+物流</span><span className="text-red-500">-¥{stats.hairMaskAnalysis.ourMask.priceCNY} -¥{stats.hairMaskAnalysis.ourMask.logistics}</span></div>
                  <div className="flex justify-between"><span>平台运营费(26%)</span><span className="text-red-500">-₽{Math.round(stats.hairMaskAnalysis.mask300gAvgPrice * 0.26)} ≈ -¥{(stats.hairMaskAnalysis.mask300gAvgPrice * 0.26 * R).toFixed(1)}</span></div>
                  <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span>净利润/单</span><span className={stats.hairMaskAnalysis.profitAt300gAvg.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{stats.hairMaskAnalysis.profitAt300gAvg.profit.toFixed(2)}（{stats.hairMaskAnalysis.profitAt300gAvg.rate.toFixed(1)}%）</span></div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <h5 className="text-xs font-bold text-purple-700 mb-2">🎯 竞争定位分析</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>温和低敏</b>：无Parabens/无甲醛释放体，竞品致命短板</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>轻盈不塌</b>：D5挥发型硅油+硅弹性体，细软发友好</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>深层修护</b>：阳离子水解小麦蛋白+BTMS，受损修护逻辑更完整</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>出口合规</b>：现代防腐体系，EAC认证更顺畅</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>极致顺滑感</b>：竞品厚膜型配方"一洗就顺"更猛，我方更偏轻盈高级感</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>鱼子酱排位</b>：提取物排位靠后时需配合故事包装强化卖点</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6 mt-6">
            <h4 className="text-base font-bold text-morandi-text mb-5 flex items-center gap-2">
              <span className="text-xl">🧪</span> 竞品成分深度对比分析
            </h4>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">一、核心配方结构对比</h5>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border border-gray-200 rounded">
                <thead><tr className="bg-gray-50"><th className="px-4 py-3 text-left">模块</th><th className="px-4 py-3 text-left bg-blue-50">🐟 我方鱼子酱发膜</th><th className="px-4 py-3 text-left bg-red-50">🔴 竞品粉色鱼子酱发膜</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">基底脂肪醇</td><td className="px-4 py-3 bg-blue-50/50">鲸蜡硬脂醇 + 鲸蜡醇</td><td className="px-4 py-3 bg-red-50/50">Cetearyl Alcohol（鲸蜡硬脂醇）</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">调理剂体系</td><td className="px-4 py-3 bg-blue-50/50">BTMS + 硬脂基三甲基氯化铵 + 阳离子蛋白</td><td className="px-4 py-3 bg-red-50/50">Steartrimonium + Behenoyl PG-Trimonium + Cetrimonium + 阳离子瓜尔胶</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">硅油体系</td><td className="px-4 py-3 bg-blue-50/50">D5 + Amodimethicone + 硅弹性体（轻盈）</td><td className="px-4 py-3 bg-red-50/50">Dimethicone + Amodimethicone + Dimethiconol（更厚重）</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">成膜增稠</td><td className="px-4 py-3 bg-blue-50/50">羟乙基纤维素</td><td className="px-4 py-3 bg-red-50/50">Polyquaternium-7 + 阳离子瓜尔胶（膜感更强）</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">保湿体系</td><td className="px-4 py-3 bg-blue-50/50">甘油 + 丁二醇 + 双丙甘醇（三重保湿）</td><td className="px-4 py-3 bg-red-50/50">甘油（较简单）</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">防腐体系</td><td className="px-4 py-3 bg-green-50/50 text-green-700">苯氧乙醇 + 乙基己基甘油 + 苯甲酸钠 ✅温和</td><td className="px-4 py-3 bg-red-50/50 text-red-600">DMDM Hydantoin + Parabens ❌老派强力</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-4 py-3 font-bold">卖点成分</td><td className="px-4 py-3 bg-blue-50/50">鱼子酱提取物 + 阳离子水解小麦蛋白</td><td className="px-4 py-3 bg-red-50/50">鱼子酱提取物 + 多种色粉/云母（偏视觉包装）</td></tr>
                </tbody>
              </table>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">二、功效表现对比</h5>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-blue-700 mb-2">顺滑度</h6>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div><b>竞品更强（短期）</b>：Dimethicone+Dimethiconol更厚重包裹，Polyquaternium-7形成明显顺滑膜</div>
                  <div><b>我方更高级</b>：D5+硅弹性体带来轻盈丝滑感，BTMS更现代柔软不粘</div>
                  <div className="text-blue-600 font-bold mt-2 pt-2 border-t border-blue-100">结论：竞品更猛，我方更舒服、更耐用</div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-blue-700 mb-2">修护感</h6>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div><b>竞品</b>：偏"表面修护"，靠硅油+成膜聚合物形成涂层</div>
                  <div><b>我方</b>：阳离子水解小麦蛋白（吸附型修护）+BTMS+氨端硅油（受损部位定向吸附）</div>
                  <div className="text-blue-600 font-bold mt-2 pt-2 border-t border-blue-100">结论：我方更适合做"染烫修护""发芯护理"卖点</div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-green-700 mb-2">蓬松感/不塌发 ✅我方优势</h6>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div><b>我方</b>：D5挥发型硅油+硅弹性体（轻盈触感），细软发友好</div>
                  <div><b>竞品</b>：Dimethicone+Dimethiconol膜厚+Polyquaternium-7使发丝贴合，易塌</div>
                  <div className="text-green-600 font-bold mt-2 pt-2 border-t border-green-100">结论：细软发人群选我方，粗硬干枯发选竞品</div>
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-green-700 mb-2">刺激性/敏感风险 ✅我方优势</h6>
                <div className="text-xs space-y-2 leading-relaxed">
                  <div><b>竞品风险高</b>：DMDM Hydantoin（甲醛释放体）+ Parabens，"不够干净""易过敏""孕妇慎用"</div>
                  <div><b>我方风险低</b>：苯氧乙醇+乙基己基甘油+苯甲酸钠，现代温和体系</div>
                  <div className="text-green-600 font-bold mt-2 pt-2 border-t border-green-100">结论：我方适合Clean Beauty/温和修护/敏感发质，更容易长期复购</div>
                </div>
              </div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">三、合规与出口风险</h5>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                <h6 className="text-sm font-bold text-green-700 mb-2">✅ 我方：低风险</h6>
                <div className="text-xs text-green-700 space-y-1.5 leading-relaxed">
                  <div>• 配方更干净，走EAC Declaration更顺</div>
                  <div>• 无MI/MCI，整体审核风险更低</div>
                  <div>• 现代防腐体系，安全评估文件更简洁</div>
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                <h6 className="text-sm font-bold text-red-700 mb-2">❌ 竞品：高风险</h6>
                <div className="text-xs text-red-700 space-y-1.5 leading-relaxed">
                  <div>• 含DMDM+Paraben，审核文件要求更严</div>
                  <div>• 需额外浓度与安全评估报告</div>
                  <div>• 俄代可能要求更多测试</div>
                </div>
              </div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">四、Ozon差异化攻击点（详情页/卖点文案）</h5>
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 border border-blue-100 mb-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-bold text-blue-800 mb-2">🇷🇺 俄文卖点关键词</div>
                  <div className="space-y-1.5 text-xs text-blue-700 leading-relaxed">
                    <div>• <b>Без парабенов</b> — 不含Parabens</div>
                    <div>• <b>Без формальдегидных доноров</b> — 不含甲醛释放体</div>
                    <div>• <b>Легкая формула, не утяжеляет волосы</b> — 轻盈配方，不压塌头发</div>
                    <div>• <b>Восстановление после окрашивания</b> — 染烫修护</div>
                    <div>• <b>Гладкость и блеск после первого применения</b> — 一次使用即可柔顺光泽</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-green-800 mb-2">🎯 竞品无法反击的差异化</div>
                  <div className="space-y-1.5 text-xs text-green-700 leading-relaxed">
                    <div>✅ 无Parabens → 竞品含Methylparaben/Propylparaben</div>
                    <div>✅ 无甲醛释放体 → 竞品含DMDM Hydantoin</div>
                    <div>✅ 轻盈不塌发 → 竞品厚膜易塌</div>
                    <div>✅ 染烫修护逻辑 → 竞品偏表面涂层</div>
                    <div>✅ 敏感发质可用 → 竞品过敏风险高</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h5 className="text-sm font-bold text-blue-800 mb-3">💡 鱼子酱发膜上市建议</h5>
              <div className="text-sm text-blue-700 space-y-2 leading-relaxed">
                <p>• <b>定价策略</b>：对标竞品350g/₽350，我方300g定价₽{stats.hairMaskAnalysis.ourMask.ourPriceRUB}，突出"温和高端"而非低价竞争</p>
                <p>• <b>成本优势</b>：采购仅¥{stats.hairMaskAnalysis.ourMask.priceCNY}+物流¥{stats.hairMaskAnalysis.ourMask.logistics}，按₽{stats.hairMaskAnalysis.ourMask.ourPriceRUB}定价净利率{stats.hairMaskAnalysis.profitAtOurPrice.rate.toFixed(1)}%</p>
                <p>• <b>定位包装</b>："轻奢修护、顺滑但不塌、温和高端、适合染烫受损"，区别于竞品"重修护厚膜老派"</p>
                <p>• <b>目标客群</b>：染烫发质/细软发/俄罗斯女性日常长期护理（高复购），竞品更适合粗硬发</p>
                <p>• <b>标题关键词</b>："икра"（鱼子酱）、"без парабенов"（无Parabens）、"глубокое питание"（深层滋养）、"салонный уход"（沙龙护理）、"300г"</p>
                <p>• <b>季节策略</b>：9-3月为发膜旺季（供暖季干燥），8月备货上架积累评价，10月旺季冲刺</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {stats.isSprayCategory && stats.sprayAnalysis && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-morandi-text mb-4 flex items-center gap-2">
            <span className="text-2xl">🌿</span> 护发精油专项分析 · 规格与价格
          </h3>

          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-emerald-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">精油产品数</div>
              <div className="text-2xl font-bold text-emerald-700">{stats.sprayAnalysis.totalProducts}</div>
            </div>
            <div className="bg-teal-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">总销量</div>
              <div className="text-2xl font-bold text-teal-700">{stats.sprayAnalysis.totalQty.toLocaleString()}</div>
            </div>
            <div className="bg-cyan-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">100ml规格均价</div>
              <div className="text-2xl font-bold text-cyan-700">₽{stats.sprayAnalysis.spray100mlAvgPrice}</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center">
              <div className="text-xs text-morandi-text-light">精油喷雾均价</div>
              <div className="text-2xl font-bold text-amber-700">₽{stats.sprayAnalysis.oilSprayAvgPrice}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">📦 容量分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.sprayAnalysis.volumeData.slice(0, 10)} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [`₽${v}`, name]} />
                  <Bar dataKey="qty" fill="#6EE7B7" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">💰 容量价格区间</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.sprayAnalysis.priceByVolumeData} margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => [`₽${v}`, '']} />
                  <Bar dataKey="minPrice" fill="#A7F3D0" name="最低价" />
                  <Bar dataKey="avgPrice" fill="#6EE7B7" name="均价" />
                  <Bar dataKey="maxPrice" fill="#34D399" name="最高价" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">✨ 功效分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.sprayAnalysis.effectData.slice(0, 10)} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={50} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [v, name]} />
                  <Bar dataKey="qty" fill="#5EEAD4" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🎯 适用发质分布（按销量）</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.sprayAnalysis.hairTypeData.slice(0, 8)} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={40} />
                  <Tooltip formatter={(v, name) => name === '销量' ? [v.toLocaleString(), name] : [v, name]} />
                  <Bar dataKey="qty" fill="#99F6E4" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h4 className="text-sm font-semibold text-morandi-text mb-3">🏆 TOP10热销护发精油</h4>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">排名</th><th className="px-2 py-2 text-left">商品名称</th><th className="px-2 py-2 text-center">容量</th><th className="px-2 py-2 text-center">功效</th><th className="px-2 py-2 text-center">适用发质</th><th className="px-2 py-2 text-right">单价(₽)</th><th className="px-2 py-2 text-right">每100ml(₽)</th><th className="px-2 py-2 text-right">销量</th></tr></thead>
              <tbody>
                {stats.sprayAnalysis.top10Products.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-2 py-2 font-bold text-morandi-text">{i + 1}</td>
                    <td className="px-2 py-2 max-w-[200px] truncate" title={p.name}>{p.name}</td>
                    <td className="px-2 py-2 text-center"><span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px]">{p._volume || '-'}</span></td>
                    <td className="px-2 py-2 text-center"><span className="bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded text-[10px]">{p._effects || '-'}</span></td>
                    <td className="px-2 py-2 text-center"><span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded text-[10px]">{p._hairTypes || '-'}</span></td>
                    <td className="px-2 py-2 text-right font-medium">₽{Math.round(p.price).toLocaleString()}</td>
                    <td className="px-2 py-2 text-right">{p._pricePer100ml ? <span className="text-teal-600">₽{p._pricePer100ml}</span> : <span className="text-gray-300">-</span>}</td>
                    <td className="px-2 py-2 text-right font-bold">{(p.qty || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {stats.sprayAnalysis.packagingAnalysis && (
            <div className="border-t border-gray-100 pt-4 mt-4">
              <h4 className="text-sm font-bold text-morandi-text mb-4 flex items-center gap-2">
                <span className="text-lg">📦</span> 正装容量设计与备货量分析
              </h4>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-100">
                  <h5 className="text-xs font-bold text-emerald-800 mb-3">🧴 正装 150ml · 主力款</h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-morandi-text-light">包材容量</span><span className="font-bold text-emerald-700">150ml</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">市场同类产品数</span><span className="font-bold">{stats.sprayAnalysis.packagingAnalysis.fullSize.marketProductCount}款</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">市场150ml段均价</span><span className="font-bold">₽{stats.sprayAnalysis.packagingAnalysis.fullSize.avgMarketPrice}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">我方150ml定价</span><span className="font-bold text-emerald-700">₽599</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">我方每100ml</span><span className="font-bold text-emerald-600">₽{stats.sprayAnalysis.packagingAnalysis.fullSize.pricePer100ml.toFixed(0)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">国内兼容性</span><span className="text-[10px] text-emerald-600 font-bold">✅ 150ml为国内主流护发精油容量，包材通用</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-emerald-200 text-[10px] text-emerald-700 space-y-0.5">
                    <div>💡 150ml兼顾俄罗斯大容量偏好和国内标准规格</div>
                    <div>💡 对标竞品100ml定价₽459，150ml容量溢价自然</div>
                    <div>💡 大容量降低单位成本，提升复购周期</div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-4 border border-cyan-100">
                  <h5 className="text-xs font-bold text-cyan-800 mb-3">🧪 试用装 50ml · 引流款</h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-morandi-text-light">包材容量</span><span className="font-bold text-cyan-700">50ml</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">市场同类产品数</span><span className="font-bold">{stats.sprayAnalysis.packagingAnalysis.trialSize.marketProductCount}款</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">市场50ml段均价</span><span className="font-bold">₽{stats.sprayAnalysis.packagingAnalysis.trialSize.avgMarketPrice}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">试用装定价</span><span className="font-bold text-cyan-700">₽{stats.sprayAnalysis.ourSpray.skus[0].ourPriceRUB}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">试用装每100ml</span><span className="font-bold text-cyan-600">₽{stats.sprayAnalysis.packagingAnalysis.trialSize.pricePer100ml.toFixed(0)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">国内兼容性</span><span className="text-[10px] text-cyan-600 font-bold">✅ 50ml为国内旅行装/试用装标准规格</span></div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-cyan-200 text-[10px] text-cyan-700 space-y-0.5">
                    <div>💡 低价引流降低首次购买门槛</div>
                    <div>💡 试用装→正装转化路径清晰</div>
                    <div>💡 可做"买正装送试用装"促销组合</div>
                  </div>
                </div>
              </div>

              <h5 className="text-xs font-semibold text-morandi-text mb-3">📈 备货量与可销售时间分析</h5>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-morandi-text-light">TOP10日均总销量</div>
                  <div className="text-xl font-bold text-amber-700">{stats.sprayAnalysis.packagingAnalysis.top10AvgDailyQty}</div>
                  <div className="text-[10px] text-amber-600">件/天（30天均值）</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-morandi-text-light">TOP10单品日均销量</div>
                  <div className="text-xl font-bold text-amber-700">{stats.sprayAnalysis.packagingAnalysis.top10AvgDailyQtyPerProduct}</div>
                  <div className="text-[10px] text-amber-600">件/天/款（30天均值）</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-morandi-text-light">补货警戒线</div>
                  <div className="text-xl font-bold text-red-700">{stats.sprayAnalysis.packagingAnalysis.reorderPoint}</div>
                  <div className="text-[10px] text-red-600">件（生产{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}用量）</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-morandi-text-light">180天内新品日均 × 30%</div>
                  <div className="text-xl font-bold text-blue-700">{stats.sprayAnalysis.packagingAnalysis.newProductEstByNewProduct}</div>
                  <div className="text-[10px] text-blue-600">件/天（新品TOP{stats.sprayAnalysis.packagingAnalysis.sprayNewProducts180Count}款，日均{stats.sprayAnalysis.packagingAnalysis.sprayNewProductAvgDailyQtyPerProduct}件×30%）</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-[10px] text-morandi-text-light">TOP10单品日均 × 10%</div>
                  <div className="text-xl font-bold text-purple-700">{stats.sprayAnalysis.packagingAnalysis.newProductEstByTop10}</div>
                  <div className="text-[10px] text-purple-600">件/天（TOP10日均{stats.sprayAnalysis.packagingAnalysis.top10AvgDailyQtyPerProduct}件×10%）</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center border-2 border-emerald-200">
                  <div className="text-[10px] text-morandi-text-light">综合预估日均销量</div>
                  <div className="text-xl font-bold text-emerald-700">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}</div>
                  <div className="text-[10px] text-emerald-600">件/天（双参考均值）</div>
                </div>
              </div>

              <div className="overflow-x-auto mb-4">
                <h5 className="text-xs font-semibold text-morandi-text mb-2">📌 原方案备货</h5>
                <table className="w-full text-xs border border-gray-200 rounded">
                  <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">规格</th><th className="px-3 py-2 text-center">备货量</th><th className="px-3 py-2 text-center">预估日均销量</th><th className="px-3 py-2 text-center">可销售天数</th><th className="px-3 py-2 text-center">生产周期</th><th className="px-3 py-2 text-center">库存安全评估</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-gray-100 bg-emerald-50/30">
                      <td className="px-3 py-2 font-bold text-emerald-700">🧴 正装 150ml</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.fullSize.stock}件</td>
                      <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.fullSizeSellDays}天</td>
                      <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}</td>
                      <td className="px-3 py-2 text-center">
                        {stats.sprayAnalysis.packagingAnalysis.fullSizeSellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全（可售{stats.sprayAnalysis.packagingAnalysis.fullSizeSellDays}天 &gt; 生产{stats.sprayAnalysis.packagingAnalysis.productionDaysMax}天）</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足（需提前补货）</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-t border-gray-100 bg-cyan-50/30">
                      <td className="px-3 py-2 font-bold text-cyan-700">🧪 试用装 50ml</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.trialSize.stock}件</td>
                      <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.trialSizeSellDays}天</td>
                      <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}</td>
                      <td className="px-3 py-2 text-center">
                        {stats.sprayAnalysis.packagingAnalysis.trialSizeSellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全（可售{stats.sprayAnalysis.packagingAnalysis.trialSizeSellDays}天 &gt; 生产{stats.sprayAnalysis.packagingAnalysis.productionDaysMax}天）</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足（需提前补货）</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {stats.sprayAnalysis.packagingAnalysis.improvedFullSize && (
                <div className="overflow-x-auto mb-4">
                  <h5 className="text-xs font-semibold text-morandi-text mb-2">🚀 改进备货方案</h5>
                  <table className="w-full text-xs border border-blue-200 rounded">
                    <thead><tr className="bg-blue-50"><th className="px-3 py-2 text-left">规格</th><th className="px-3 py-2 text-center">备货量</th><th className="px-3 py-2 text-center">预估日均销量</th><th className="px-3 py-2 text-center">可销售天数</th><th className="px-3 py-2 text-center">生产周期</th><th className="px-3 py-2 text-center">库存安全评估</th></tr></thead>
                    <tbody>
                      <tr className="border-t border-blue-100 bg-blue-50/30">
                        <td className="px-3 py-2 font-bold text-blue-700">🧴 正装 150ml</td>
                        <td className="px-3 py-2 text-center font-bold">
                          <div>{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.totalStock}件</div>
                          <div className="text-[10px] text-blue-500 font-normal">🇷🇺 俄向{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.stock}件 + 🇨🇳 国内{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.domesticStock}件</div>
                        </td>
                        <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                        <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays}天</td>
                        <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}</td>
                        <td className="px-3 py-2 text-center">
                          {stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全（可售{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays}天 &gt; 生产{stats.sprayAnalysis.packagingAnalysis.productionDaysMax}天）</span>
                          ) : (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足（需提前补货）</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-t border-blue-100 bg-indigo-50/30">
                        <td className="px-3 py-2 font-bold text-indigo-700">🧪 试用装 50ml</td>
                        <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.stock}件</td>
                        <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                        <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.sellDays}天</td>
                        <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}</td>
                        <td className="px-3 py-2 text-center">
                          {stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.sellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全（可售{stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.sellDays}天 &gt; 生产{stats.sprayAnalysis.packagingAnalysis.productionDaysMax}天）</span>
                          ) : (
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足（需提前补货）</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-2 text-[10px] text-blue-700 space-y-0.5 bg-blue-50 rounded p-2">
                    <div>💡 正装150ml总计{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.totalStock}件（俄向{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.stock}件 + 国内{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.domesticStock}件），俄方可售{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays}天</div>
                    <div>💡 试用装50ml保持200件不变，可售{stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.sellDays}天</div>
                    <div>💡 150ml包材通用，俄向/国内共享同款包材，降低包材开模成本</div>
                    <div>💡 改进方案俄方正装可覆盖{Math.round(stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays / 30)}个月销售周期，减少补货频次</div>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h5 className="text-xs font-bold text-amber-800 mb-2">📋 备货策略建议</h5>
                <div className="text-xs text-amber-700 space-y-1.5 leading-relaxed">
                  <p>• <b>原方案备货</b>：正装150ml × {stats.sprayAnalysis.packagingAnalysis.fullSize.stock}件 + 试用装50ml × {stats.sprayAnalysis.packagingAnalysis.trialSize.stock}件</p>
                  <p>• <b>改进方案备货</b>：正装150ml × {stats.sprayAnalysis.packagingAnalysis.improvedFullSize.totalStock}件（🇷🇺俄向{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.stock}件 + 🇨🇳国内{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.domesticStock}件）+ 试用装50ml × {stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.stock}件</p>
                  <p>• <b>改进可售周期</b>：正装约{stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays}天 / 试用装约{stats.sprayAnalysis.packagingAnalysis.improvedTrialSize.sellDays}天（基于新品保守日均{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件估算）</p>
                  <p>• <b>补货时机</b>：库存降至<b>{stats.sprayAnalysis.packagingAnalysis.reorderPoint}件</b>时立即下单（覆盖{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}生产期）</p>
                  <p>• <b>生产周期</b>：{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}，改进方案建议上架后第{Math.max(1, stats.sprayAnalysis.packagingAnalysis.improvedFullSize.sellDays - stats.sprayAnalysis.packagingAnalysis.productionDaysMax)}天启动第二批生产</p>
                  <p>• <b>销量预估依据</b>：双参考估算——180天内喷雾新品TOP{stats.sprayAnalysis.packagingAnalysis.sprayNewProducts180Count}款日均{stats.sprayAnalysis.packagingAnalysis.sprayNewProductAvgDailyQtyPerProduct}件×30%={stats.sprayAnalysis.packagingAnalysis.newProductEstByNewProduct}件/天，TOP10单品日均{stats.sprayAnalysis.packagingAnalysis.top10AvgDailyQtyPerProduct}件×10%={stats.sprayAnalysis.packagingAnalysis.newProductEstByTop10}件/天，综合取均值{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</p>
                  <p>• <b>容量策略</b>：150ml正装兼容国内市场主流规格，50ml试用装降低首次购买门槛，两规格共享配方仅换包材</p>
                </div>
              </div>
            </div>
          )}

          {stats.sprayAnalysis.packagingAnalysis?.finalStock && (
            <div className="border-t border-gray-100 pt-4 mt-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-morandi-text flex items-center gap-2">
                  <span className="text-lg">📦</span> 精油喷雾备货计算
                </h4>
                <button
                  onClick={exportSprayStockPDF}
                  disabled={sprayExporting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {sprayExporting ? '导出中...' : '导出PDF'}
                </button>
              </div>

              <div ref={sprayStockRef} className="bg-white p-2">

              <div className="bg-gradient-to-r from-indigo-50 via-emerald-50 to-cyan-50 rounded-lg p-4 mb-4 border border-indigo-100">
                <h5 className="text-xs font-bold text-indigo-800 mb-3">🎯 选品原因与市场容量</h5>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h6 className="text-[11px] font-semibold text-indigo-700">为什么选护发精油喷雾？</h6>
                    <ul className="text-[11px] text-morandi-text space-y-1 leading-relaxed list-none">
                      <li>✅ 市场需求大：喷雾品类共{stats.sprayAnalysis.totalProducts}款产品，30天总销量{stats.sprayAnalysis.totalQty?.toLocaleString()}件，需求旺盛</li>
                      <li>✅ 竞争可切入：TOP10品牌集中度适中，新品牌有机会突围</li>
                      <li>✅ 差异化定位：轻盈不塌·无矿物油·高端修护，填补市场空白</li>
                      <li>✅ 双规格策略：150ml正装主攻复购利润，50ml试用装降低首次购买门槛</li>
                      <li>✅ 搭配销售：50ml试用装可搭配吹风机赠品，带动关联销售</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h6 className="text-[11px] font-semibold text-emerald-700">市场分析</h6>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">TOP300产品数</div>
                        <div className="text-sm font-bold text-emerald-700">{stats.sprayAnalysis.totalProducts}款</div>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">30天总销量</div>
                        <div className="text-sm font-bold text-teal-700">{stats.sprayAnalysis.totalQty?.toLocaleString()}件</div>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">30天总销售额</div>
                        <div className="text-sm font-bold text-indigo-700">¥{Math.round(stats.sprayAnalysis.totalSales * R).toLocaleString()}</div>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">品类均价</div>
                        <div className="text-sm font-bold text-amber-700">¥{Math.round(stats.sprayAnalysis.sprayAvgPrice * R)}</div>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">市场集中度</div>
                        <div className="text-[11px] font-bold text-rose-700">TOP3 {stats.sprayAnalysis.sprayMarketConcentration?.toFixed(1)}% / TOP10 {stats.sprayAnalysis.sprayMarketConcentrationTop10?.toFixed(1)}%</div>
                      </div>
                      <div className="bg-white/60 rounded p-2 text-center">
                        <div className="text-[10px] text-morandi-text-light">竞争格局</div>
                        <div className="text-sm font-bold text-green-700">分散型</div>
                        <div className="text-[10px] text-green-500">新品有进入机会</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <h5 className="text-xs font-semibold text-morandi-text mb-3">📊 市场容量分布（按销量占比）</h5>
              <div className="flex items-center gap-4 mb-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{backgroundColor:'#6EE7B7'}}></span> 销量（件）</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{backgroundColor:'#34D399'}}></span> 销量占比（%）</span>
              </div>
              <div className="mb-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.sprayAnalysis.packagingAnalysis.volumeDistribution} margin={{ left: 10, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                    <Tooltip formatter={(v, name) => name === '销量占比' ? [`${v}%`, name] : [v.toLocaleString(), name]} />
                    <Bar yAxisId="left" dataKey="qty" fill="#6EE7B7" name="销量" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fill: '#6EE7B7', formatter: (v) => v.toLocaleString() }} />
                    <Bar yAxisId="right" dataKey="pct" fill="#34D399" name="销量占比" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 10, fill: '#34D399', formatter: (v) => `${v}%` }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <h5 className="text-xs font-semibold text-morandi-text mb-3">📋 备货明细</h5>
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-xs border border-indigo-200 rounded">
                  <thead><tr className="bg-indigo-50"><th className="px-3 py-2 text-left">规格</th><th className="px-3 py-2 text-center">用途/渠道</th><th className="px-3 py-2 text-center">数量</th><th className="px-3 py-2 text-center">单瓶</th><th className="px-3 py-2 text-center">总ml</th><th className="px-3 py-2 text-center">小计</th><th className="px-3 py-2 text-center">预估日均</th><th className="px-3 py-2 text-center">可售天数</th><th className="px-3 py-2 text-center">安全评估</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-indigo-100 bg-emerald-50/30">
                      <td className="px-3 py-2 font-bold text-emerald-700" rowSpan="2">🧴 150ml 正装</td>
                      <td className="px-3 py-2 text-center">🇷🇺 俄向销售</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.overseas}件</td>
                      <td className="px-3 py-2 text-center" rowSpan="2">150ml</td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-600" rowSpan="2">{(stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total * 150).toLocaleString()}ml</td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-700" rowSpan="2">{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total}件</td>
                      <td className="px-3 py-2 text-center" rowSpan="1">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                      <td className="px-3 py-2 text-center font-bold" rowSpan="1">{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.sellDays}天</td>
                      <td className="px-3 py-2 text-center" rowSpan="1">
                        {stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.sellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足</span>
                        )}
                      </td>
                    </tr>
                    <tr className="border-t border-indigo-100 bg-emerald-50/15">
                      <td className="px-3 py-2 text-center">🇨🇳 国内备货</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.domestic}件</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center"><span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px]">国内商城</span></td>
                    </tr>
                    <tr className="border-t border-indigo-100 bg-cyan-50/30">
                      <td className="px-3 py-2 font-bold text-cyan-700" rowSpan="3">🧪 50ml 试用装</td>
                      <td className="px-3 py-2 text-center">💨 吹风机赠品</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.hairDryer}件</td>
                      <td className="px-3 py-2 text-center" rowSpan="3">50ml</td>
                      <td className="px-3 py-2 text-center font-bold text-cyan-600" rowSpan="3">{(stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total * 50).toLocaleString()}ml</td>
                      <td className="px-3 py-2 text-center font-bold text-cyan-700" rowSpan="3">{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total}件</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center"><span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px]">赠品</span></td>
                    </tr>
                    <tr className="border-t border-indigo-100 bg-cyan-50/20">
                      <td className="px-3 py-2 text-center">🇨🇳 国内备货</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.domestic}件</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center text-gray-400">—</td>
                      <td className="px-3 py-2 text-center"><span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px]">国内商城</span></td>
                    </tr>
                    <tr className="border-t border-indigo-100 bg-cyan-50/10">
                      <td className="px-3 py-2 text-center">🇷🇺 俄向销售</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.overseas}件</td>
                      <td className="px-3 py-2 text-center">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</td>
                      <td className="px-3 py-2 text-center font-bold">{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.sellDays}天</td>
                      <td className="px-3 py-2 text-center">
                        {stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.sellDays > stats.sprayAnalysis.packagingAnalysis.productionDaysMax ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">✅ 安全</span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold">⚠️ 不足</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-indigo-50 rounded-lg p-3 mb-4 border border-indigo-100">
                <h5 className="text-xs font-bold text-indigo-800 mb-2">📦 总量计算</h5>
                <div className="text-xs text-indigo-700 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded text-[10px] font-bold">50ml</span>
                    <span>💨{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.hairDryer}件 + 🇨🇳{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.domestic}件 + 🇷🇺{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.overseas}件 = <b>{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total}件</b> × 50ml = <b>{(stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total * 50).toLocaleString()}ml</b></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] font-bold">150ml</span>
                    <span>🇷🇺{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.overseas}件 + 🇨🇳{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.domestic}件 = <b>{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total}件</b> × 150ml = <b>{(stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total * 150).toLocaleString()}ml</b></span>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-indigo-200">
                    <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">合计</span>
                    <span className="font-bold text-indigo-800">{stats.sprayAnalysis.packagingAnalysis.finalStock.totalStock}件 / {(stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total * 50 + stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total * 150).toLocaleString()}ml</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-indigo-50 rounded-lg p-3 text-center border border-indigo-100">
                  <div className="text-[10px] text-morandi-text-light">总备货量</div>
                  <div className="text-xl font-bold text-indigo-700">{stats.sprayAnalysis.packagingAnalysis.finalStock.totalStock}</div>
                  <div className="text-[10px] text-indigo-600">件</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                  <div className="text-[10px] text-morandi-text-light">综合预估日均</div>
                  <div className="text-xl font-bold text-blue-700">{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}</div>
                  <div className="text-[10px] text-blue-600">件/天</div>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
                  <div className="text-[10px] text-morandi-text-light">补货警戒线</div>
                  <div className="text-xl font-bold text-red-700">{stats.sprayAnalysis.packagingAnalysis.reorderPoint}</div>
                  <div className="text-[10px] text-red-600">件（{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}用量）</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                  <div className="text-[10px] text-morandi-text-light">生产周期</div>
                  <div className="text-xl font-bold text-amber-700">{stats.sprayAnalysis.packagingAnalysis.productionDaysMin}</div>
                  <div className="text-[10px] text-amber-600">天</div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-indigo-50 to-cyan-50 rounded-lg p-4 border border-indigo-200">
                <h5 className="text-xs font-bold text-indigo-800 mb-2">📋 备货策略总结</h5>
                <div className="text-xs text-indigo-700 space-y-1.5 leading-relaxed">
                  <p>• <b>150ml正装</b>：{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.total}件（🇷🇺俄向{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.overseas}件 + 🇨🇳国内{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.domestic}件），仅俄向{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.overseas}件参与销量计算，可售{stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.sellDays}天（约{Math.round(stats.sprayAnalysis.packagingAnalysis.finalStock.size150ml.sellDays / 30)}个月）</p>
                  <p>• <b>50ml试用装</b>：{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.total}件（💨吹风机赠品{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.hairDryer}件 + 🇨🇳国内{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.domestic}件 + 🇷🇺俄向{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.overseas}件），仅俄向{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.overseas}件参与销量计算，可售{stats.sprayAnalysis.packagingAnalysis.finalStock.size50ml.sellDays}天</p>
                  <p>• <b>补货时机</b>：库存降至<b>{stats.sprayAnalysis.packagingAnalysis.reorderPoint}件</b>时立即下单（覆盖{stats.sprayAnalysis.packagingAnalysis.productionDaysDisplay}生产期）</p>
                  <p>• <b>销量预估依据</b>：180天内喷雾新品TOP{stats.sprayAnalysis.packagingAnalysis.sprayNewProducts180Count}款日均×30% + TOP10单品日均×10%，综合取均值{stats.sprayAnalysis.packagingAnalysis.newProductEstDailyQty}件/天</p>
                  <p>• <b>容量策略</b>：150ml正装兼顾俄罗斯大容量偏好和国内标准规格，50ml试用装降低首次购买门槛并可搭配吹风机销售</p>
                </div>
              </div>
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <h4 className="text-sm font-bold text-morandi-text mb-4 flex items-center gap-2">
              <span className="text-lg">🌿</span> 护发精油市场定位分析
            </h4>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-100">
                <h5 className="text-xs font-bold text-emerald-800 mb-2">🌿 我方产品 · {stats.sprayAnalysis.ourSpray.positioning}</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-morandi-text-light">规格</span><span className="font-bold">{stats.sprayAnalysis.ourSpray.skus.map(s => s.volume).join(' / ')}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">定价</span><span className="font-bold text-emerald-700">₽{stats.sprayAnalysis.ourSpray.skus.map(s => s.ourPriceRUB).join(' / ₽')}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">每100ml</span><span className="font-bold text-emerald-600">₽{stats.sprayAnalysis.ourSpray.skus.map(s => Math.round(s.ourPriceRUB / parseInt(s.volume) * 100)).join(' / ₽')}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">采购成本</span><span className="font-bold">¥{stats.sprayAnalysis.ourSpray.skus.map(s => s.priceCNY).join(' / ¥')}</span></div>
                  <div className="flex justify-between"><span className="text-morandi-text-light">物流费</span><span className="font-bold">¥{stats.sprayAnalysis.ourSpray.skus.map(s => s.logistics).join(' / ¥')}</span></div>
                </div>
                <div className="mt-2 pt-2 border-t border-emerald-200">
                  <div className="text-[10px] text-emerald-700 font-bold mb-1">核心配方</div>
                  <div className="text-[10px] text-emerald-600 mb-1.5">{stats.sprayAnalysis.ourSpray.ingredients}</div>
                  <div className="text-[10px] text-emerald-700 space-y-0.5">
                    {stats.sprayAnalysis.ourSpray.features.map((f, i) => (
                      <div key={i}>✓ {f}</div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-red-200">
                <h5 className="text-xs font-bold text-red-700 mb-2">🔴 5款竞品速览</h5>
                <div className="space-y-1.5 text-xs">
                  {stats.sprayAnalysis.competitorsSpray.map(c => (
                    <div key={c.id} className="flex justify-between items-center border-b border-gray-50 pb-1">
                      <span className="font-bold text-red-600">{c.brand}</span>
                      <span className="text-[10px]">{c.volume} / <b>₽{c.priceRUB}</b> / ₽{c.volume === '50ml' ? (c.priceRUB / 50 * 100).toFixed(0) : c.priceRUB}/100ml</span>
                      <span className="text-[10px] text-morandi-text-light">{c.positioning}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-red-200">
                  <div className="text-[10px] text-red-600 space-y-0.5">
                    <div>📌 主流价格带：<b>₽320-500/100ml</b></div>
                    <div>📌 全部为<b>硅油主导派</b>，植物油仅做卖点包装</div>
                    <div>📌 竞品2和5几乎同配方不同品牌，同质化极高</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white rounded-lg p-3 border border-green-100">
                <h5 className="text-xs font-bold text-green-700 mb-2">💰 三规格利润测算</h5>
                {stats.sprayAnalysis.profitBySku.map((sku, i) => (
                  <div key={i} className="space-y-1 text-xs border-b border-gray-100 pb-2 mb-2 last:border-0 last:pb-0 last:mb-0">
                    <div className="text-[10px] font-bold text-blue-600">{sku.label} {sku.volume} · ₽{sku.ourPriceRUB}</div>
                    <div className="flex justify-between"><span>售价</span><span className="font-bold">₽{sku.ourPriceRUB} ≈ ¥{(sku.ourPriceRUB * R).toFixed(1)}</span></div>
                    <div className="flex justify-between"><span>采购+物流</span><span className="text-red-500">-¥{sku.priceCNY} -¥{sku.logistics}</span></div>
                    <div className="flex justify-between"><span>平台运营费(26%)</span><span className="text-red-500">-₽{Math.round(sku.ourPriceRUB * 0.26)} ≈ -¥{(sku.ourPriceRUB * 0.26 * R).toFixed(1)}</span></div>
                    <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span>净利润/单</span><span className={sku.standard.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{sku.standard.profit.toFixed(2)}（{sku.standard.rate.toFixed(1)}%）</span></div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <h5 className="text-xs font-bold text-blue-700 mb-2">🚚 物流时效利润对比</h5>
                <table className="w-full text-xs">
                  <thead><tr className="bg-blue-50"><th className="px-2 py-1 text-left">规格</th><th className="px-2 py-1 text-center">🚀 特快<br/><span className="text-[9px] font-normal">5-10天</span></th><th className="px-2 py-1 text-center">📦 标准<br/><span className="text-[9px] font-normal">10-15天</span></th><th className="px-2 py-1 text-center">🚛 经济<br/><span className="text-[9px] font-normal">15-25天</span></th></tr></thead>
                  <tbody>
                    {stats.sprayAnalysis.profitBySku.map((sku, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 font-bold">{sku.label}<br/><span className="text-[9px] font-normal text-gray-500">₽{sku.ourPriceRUB}</span></td>
                        <td className="px-2 py-1.5 text-center"><div className={sku.express.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{sku.express.profit.toFixed(1)}</div><div className="text-[9px] text-gray-500">{sku.express.rate.toFixed(1)}%</div><div className="text-[9px] text-red-400">运费¥{sku.logistics + 5}</div></td>
                        <td className="px-2 py-1.5 text-center bg-blue-50/50"><div className={sku.standard.profit >= 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>¥{sku.standard.profit.toFixed(1)}</div><div className="text-[9px] text-gray-500">{sku.standard.rate.toFixed(1)}%</div><div className="text-[9px] text-gray-400">运费¥{sku.logistics}</div></td>
                        <td className="px-2 py-1.5 text-center"><div className={sku.economy.profit >= 0 ? 'text-green-600' : 'text-red-600'}>¥{sku.economy.profit.toFixed(1)}</div><div className="text-[9px] text-gray-500">{sku.economy.rate.toFixed(1)}%</div><div className="text-[9px] text-green-400">运费¥{Math.max(0, sku.logistics - 5)}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 text-[10px] text-blue-600 space-y-0.5">
                  <div>💡 特快运费+¥5，适合急需补货/新品冷启动快速到仓</div>
                  <div>💡 标准运费为当前基准，平衡时效与成本</div>
                  <div>💡 经济运费-¥5，适合稳定期大批量补货</div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-purple-100">
                <h5 className="text-xs font-bold text-purple-700 mb-2">🎯 竞争定位分析</h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>轻盈不塌</b>：异十二烷+异链烷烃超轻基底，vs 竞品矿物油/厚硅油易油腻</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>无矿物油/无色粉</b>：更干净配方，攻击竞品2/5含矿物油+CI色粉</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>山茶花提取物</b>：天然修护+抗氧化，竞品普遍缺功能型活性物</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>维E防热损伤</b>：吹风/夹发前保护，竞品多数无此功能</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>细软发友好</b>：轻盈质地不压塌，对抗竞品1的厚重油腻</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>即时顺滑感</b>：硅油型竞品"一喷就顺"更明显，我方偏"越用越顺"</span></div>
                  <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>光泽感</b>：竞品3的Phenyl Trimethicone反光最强，我方需靠维E+植物油叙事</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6 mt-6">
            <h4 className="text-base font-bold text-morandi-text mb-5 flex items-center gap-2">
              <span className="text-xl">🧪</span> 竞品成分深度对比分析
            </h4>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">一、竞品基础信息对比（价格/容量/单位成本）</h5>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">产品</th><th className="px-3 py-2 text-center">容量</th><th className="px-3 py-2 text-right">售价(₽)</th><th className="px-3 py-2 text-right">₽/100ml</th><th className="px-3 py-2 text-left">价格定位</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100 bg-emerald-50/30"><td className="px-3 py-2 font-bold text-emerald-700">🌿 我方</td><td className="px-3 py-2 text-center">{stats.sprayAnalysis.ourSpray.skus.map(s => s.volume).join('/')}</td><td className="px-3 py-2 text-right font-bold text-emerald-700">{stats.sprayAnalysis.ourSpray.skus.map(s => s.ourPriceRUB).join('-')}</td><td className="px-3 py-2 text-right font-bold text-emerald-700">{stats.sprayAnalysis.ourSpray.skus.map(s => Math.round(s.ourPriceRUB / parseInt(s.volume) * 100)).join('-')}</td><td className="px-3 py-2"><span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px]">轻盈高端·中高价位</span></td></tr>
                  {stats.sprayAnalysis.competitorsSpray.map(c => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-bold text-red-600">{c.brand}</td>
                      <td className="px-3 py-2 text-center">{c.volume}</td>
                      <td className="px-3 py-2 text-right font-medium">{c.priceRUB}</td>
                      <td className="px-3 py-2 text-right font-bold">{c.volume === '50ml' ? (c.priceRUB / 50 * 100).toFixed(0) : c.priceRUB}</td>
                      <td className="px-3 py-2"><span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px]">{c.positioning}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] text-morandi-text-light mt-1.5">📌 俄罗斯护发精油主流价格带：₽320-500/100ml，我方₽{stats.sprayAnalysis.ourSpray.skus.map(s => Math.round(s.ourPriceRUB / parseInt(s.volume) * 100)).join('-')}/100ml处于中高段</div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">二、核心配方结构对比</h5>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">模块</th><th className="px-3 py-2 text-left bg-emerald-50">🌿 我方</th><th className="px-3 py-2 text-left bg-red-50">🔴 竞品1</th><th className="px-3 py-2 text-left bg-red-50">🔴 竞品2</th><th className="px-3 py-2 text-left bg-red-50">🔴 竞品3</th><th className="px-3 py-2 text-left bg-red-50">🔴 竞品4</th><th className="px-3 py-2 text-left bg-red-50">🔴 竞品5</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">基底</td><td className="px-3 py-2 bg-emerald-50/30">异十二烷+C13-14异链烷烃</td><td className="px-3 py-2 bg-red-50/30">环戊硅氧烷(D5)</td><td className="px-3 py-2 bg-red-50/30">Cyclomethicone+D5</td><td className="px-3 py-2 bg-red-50/30">环戊硅氧烷(D5)</td><td className="px-3 py-2 bg-red-50/30">D5+D6</td><td className="px-3 py-2 bg-red-50/30">Cyclomethicone+D5</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">硅油体系</td><td className="px-3 py-2 bg-emerald-50/30">聚二甲基硅氧烷醇</td><td className="px-3 py-2 bg-red-50/30">Dimethiconol+Amodimethicone</td><td className="px-3 py-2 bg-red-50/30">Dimethicone(厚)</td><td className="px-3 py-2 bg-red-50/30">Dimethiconol+Phenyl Trimethicone</td><td className="px-3 py-2 bg-red-50/30">Dimethiconol</td><td className="px-3 py-2 bg-red-50/30">Dimethicone(厚)</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">植物油</td><td className="px-3 py-2 bg-emerald-50/30">山茶花+霍霍巴+橄榄油</td><td className="px-3 py-2 bg-red-50/30">乳木果+夏威夷果</td><td className="px-3 py-2 bg-red-50/30">Argan+Jojoba+Macadamia</td><td className="px-3 py-2 bg-red-50/30">7种植物油+角鲨烷</td><td className="px-3 py-2 bg-red-50/30">夏威夷果+牛油果+甜杏仁</td><td className="px-3 py-2 bg-red-50/30">Argan+Jojoba+Macadamia</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">矿物油</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无 ✅</td><td className="px-3 py-2 bg-red-50/30 text-red-600">✅ 有</td><td className="px-3 py-2 bg-red-50/30 text-red-600">✅ 有</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无</td><td className="px-3 py-2 bg-red-50/30 text-red-600">✅ 有</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">色粉</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无 ✅</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无</td><td className="px-3 py-2 bg-red-50/30 text-red-600">CI47000/CI26100</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无</td><td className="px-3 py-2 bg-green-50/50 text-green-700">❌ 无</td><td className="px-3 py-2 bg-red-50/30 text-red-600">CI47000/CI26100</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">功能活性物</td><td className="px-3 py-2 bg-emerald-50/30">山茶花提取物+维E</td><td className="px-3 py-2 bg-red-50/30">无</td><td className="px-3 py-2 bg-red-50/30">无</td><td className="px-3 py-2 bg-red-50/30">Bisabolol+3种提取物</td><td className="px-3 py-2 bg-red-50/30">BHT(抗氧化)</td><td className="px-3 py-2 bg-red-50/30">无</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold">香精过敏原</td><td className="px-3 py-2 bg-green-50/50 text-green-700">仅日用香精</td><td className="px-3 py-2 bg-red-50/30 text-red-600">柠檬烯/芳樟醇/香豆素</td><td className="px-3 py-2 bg-red-50/30 text-red-600">含Fragrance</td><td className="px-3 py-2 bg-red-50/30 text-red-600">含香水成分</td><td className="px-3 py-2 bg-red-50/30 text-red-600">己基肉桂醛/柠檬烯/香豆素</td><td className="px-3 py-2 bg-red-50/30 text-red-600">含Fragrance</td></tr>
                </tbody>
              </table>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">三、逐个竞品功效推断 + 优缺点</h5>
            <div className="space-y-3 mb-6">
              {stats.sprayAnalysis.competitorsSpray.map(c => (
                <div key={c.id} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-sm font-bold text-red-700">🔴 {c.brand}（{c.volume} / ₽{c.priceRUB}）</h6>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{c.positioning}</span>
                  </div>
                  <div className="text-[10px] text-morandi-text-light mb-2">核心成分：{c.ingredients}</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] font-bold text-green-700 mb-1">✅ 优点</div>
                      <div className="text-[10px] text-green-700 space-y-0.5">
                        {c.strengths.map((s, i) => <div key={i}>• {s}</div>)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-red-700 mb-1">❌ 缺点/风险</div>
                      <div className="text-[10px] text-red-700 space-y-0.5">
                        {c.risks.map((r, i) => <div key={i}>• {r}</div>)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">四、功效强度排名（消费者感知）</h5>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-amber-700 mb-3">✨ 光泽感（亮/反光）</h6>
                <div className="space-y-2">
                  {[{name: '竞品3', val: 5}, {name: '竞品4', val: 4}, {name: '🌿我方', val: 4, isOurs: true}, {name: '竞品2', val: 3}, {name: '竞品5', val: 3}, {name: '竞品1', val: 3}].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-[10px] w-14 ${item.isOurs ? 'font-bold text-emerald-700' : 'text-gray-600'}`}>{item.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3"><div className={`h-3 rounded-full ${item.isOurs ? 'bg-emerald-400' : 'bg-amber-300'}`} style={{width: `${item.val * 20}%`}}></div></div>
                      <span className="text-[10px] text-gray-500">{item.val}/5</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-blue-700 mb-3">🌊 顺滑/柔顺（立刻好梳）</h6>
                <div className="space-y-2">
                  {[{name: '竞品1', val: 5}, {name: '竞品4', val: 5}, {name: '🌿我方', val: 4, isOurs: true}, {name: '竞品2', val: 4}, {name: '竞品3', val: 4}, {name: '竞品5', val: 4}].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-[10px] w-14 ${item.isOurs ? 'font-bold text-emerald-700' : 'text-gray-600'}`}>{item.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3"><div className={`h-3 rounded-full ${item.isOurs ? 'bg-emerald-400' : 'bg-blue-300'}`} style={{width: `${item.val * 20}%`}}></div></div>
                      <span className="text-[10px] text-gray-500">{item.val}/5</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-purple-700 mb-3">💧 厚重滋润（干枯粗硬发）</h6>
                <div className="space-y-2">
                  {[{name: '竞品1', val: 5}, {name: '竞品2', val: 3}, {name: '竞品5', val: 3}, {name: '🌿我方', val: 3, isOurs: true}, {name: '竞品4', val: 2}, {name: '竞品3', val: 2}].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-[10px] w-14 ${item.isOurs ? 'font-bold text-emerald-700' : 'text-gray-600'}`}>{item.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3"><div className={`h-3 rounded-full ${item.isOurs ? 'bg-emerald-400' : 'bg-purple-300'}`} style={{width: `${item.val * 20}%`}}></div></div>
                      <span className="text-[10px] text-gray-500">{item.val}/5</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <h6 className="text-sm font-bold text-emerald-700 mb-3">🍃 轻盈不油腻（细软发）✅我方最强</h6>
                <div className="space-y-2">
                  {[{name: '🌿我方', val: 5, isOurs: true}, {name: '竞品4', val: 5}, {name: '竞品3', val: 4}, {name: '竞品2', val: 2}, {name: '竞品5', val: 2}, {name: '竞品1', val: 1}].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`text-[10px] w-14 ${item.isOurs ? 'font-bold text-emerald-700' : 'text-gray-600'}`}>{item.name}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-3"><div className={`h-3 rounded-full ${item.isOurs ? 'bg-emerald-400' : 'bg-teal-300'}`} style={{width: `${item.val * 20}%`}}></div></div>
                      <span className="text-[10px] text-gray-500">{item.val}/5</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">五、成分风险点对比（合规/投诉角度）</h5>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-xs border border-gray-200 rounded">
                <thead><tr className="bg-gray-50"><th className="px-3 py-2 text-left">风险点</th><th className="px-3 py-2 text-center">涉及竞品</th><th className="px-3 py-2 text-left">风险说明</th></tr></thead>
                <tbody>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold text-red-600">香精过敏原</td><td className="px-3 py-2 text-center">竞品1、4</td><td className="px-3 py-2">柠檬烯/芳樟醇/香豆素等，易被敏感用户差评</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold text-amber-600">矿物油</td><td className="px-3 py-2 text-center">竞品1、2、5</td><td className="px-3 py-2">合规无问题，但高端感降低，高端价位易被挑刺</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold text-amber-600">色粉CI47000/CI26100</td><td className="px-3 py-2 text-center">竞品2、5</td><td className="px-3 py-2">部分消费者认为"染色添加剂多"</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold text-amber-600">BHT争议成分</td><td className="px-3 py-2 text-center">竞品4</td><td className="px-3 py-2">合规但存在争议心智，部分消费者抵触</td></tr>
                  <tr className="border-t border-gray-100"><td className="px-3 py-2 font-bold text-amber-600">成分过于复杂</td><td className="px-3 py-2 text-center">竞品3</td><td className="px-3 py-2">提取物多，供应链文件和稳定性风险上升</td></tr>
                </tbody>
              </table>
              <div className="text-[10px] text-morandi-text-light mt-1.5">📌 真正容易引发投诉的是<b>香精致敏</b>和<b>油腻塌发</b>，我方配方均无此风险</div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">六、市场格局结论</h5>
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200 mb-6">
              <div className="text-sm text-amber-800 space-y-2 leading-relaxed">
                <p>• <b>市场主流是硅油体系</b>，不是纯植物油。核心竞争点：顺滑感、光泽感、香味、是否塌发。植物油更多是"卖点包装"</p>
                <p>• <b>价格带非常集中</b>：₽320-400走量款 / ₽480-520高端溢价款，我方₽{stats.sprayAnalysis.ourSpray.skus[0].ourPriceRUB}-{stats.sprayAnalysis.ourSpray.skus[2].ourPriceRUB}覆盖引流到高端全价格段</p>
                <p>• <b>配方同质化极高</b>：竞品2和5几乎同配方不同品牌。想赢不靠配方微调，必须靠<b>香型差异化 + 使用体验(轻盈/不塌) + 文案与功效定位 + 包装高级感</b></p>
              </div>
            </div>

            <h5 className="text-sm font-semibold text-morandi-text mb-3">七、Ozon差异化攻击点（详情页/卖点文案）</h5>
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-100 mb-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-bold text-emerald-800 mb-2">🇷🇺 俄文卖点关键词</div>
                  <div className="space-y-1.5 text-xs text-emerald-700 leading-relaxed">
                    <div>• <b>Не утяжеляет волосы</b> — 不压塌头发（轻盈路线）</div>
                    <div>• <b>Без минерального масла</b> — 不含矿物油</div>
                    <div>• <b>Без красителей</b> — 不含色素</div>
                    <div>• <b>Легкая текстура</b> — 轻盈质地</div>
                    <div>• <b>Термозащита</b> — 防热损伤</div>
                    <div>• <b>Масло камелии</b> — 山茶花油</div>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-bold text-teal-800 mb-2">🎯 竞品无法反击的差异化</div>
                  <div className="space-y-1.5 text-xs text-teal-700 leading-relaxed">
                    <div>✅ 无矿物油 → 竞品1/2/5含矿物油</div>
                    <div>✅ 无色粉 → 竞品2/5含CI47000/CI26100</div>
                    <div>✅ 轻盈不塌发 → 竞品1厚重油腻</div>
                    <div>✅ 山茶花提取物 → 竞品普遍缺功能型活性物</div>
                    <div>✅ 维E防热损伤 → 竞品多数无此功能</div>
                    <div>✅ 细软发友好 → 对抗所有厚重型竞品</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-lg p-4">
              <h5 className="text-sm font-bold text-emerald-800 mb-3">💡 护发精油上市建议</h5>
              <div className="text-sm text-emerald-700 space-y-2 leading-relaxed">
                <p>• <b>定价策略</b>：{stats.sprayAnalysis.ourSpray.skus[0].volume}₽{stats.sprayAnalysis.ourSpray.skus[0].ourPriceRUB}引流→{stats.sprayAnalysis.ourSpray.skus[1].volume}₽{stats.sprayAnalysis.ourSpray.skus[1].ourPriceRUB}主力→{stats.sprayAnalysis.ourSpray.skus[2].volume}₽{stats.sprayAnalysis.ourSpray.skus[2].ourPriceRUB}大容量溢价，三规格覆盖全价格段，突出"轻盈高端·无矿物油"</p>
                <p>• <b>成本优势</b>：采购¥{stats.sprayAnalysis.ourSpray.skus[0].priceCNY}-{stats.sprayAnalysis.ourSpray.skus[2].priceCNY}+物流¥{stats.sprayAnalysis.ourSpray.skus[0].logistics}-{stats.sprayAnalysis.ourSpray.skus[2].logistics}，三规格净利率{stats.sprayAnalysis.profitBySku.map(s => s.standard.rate.toFixed(1)).join('% / ')}%（陆空标准）</p>
                <p>• <b>定位包装</b>："轻盈不塌、无矿物油/无色素、山茶花修护、防热损伤"，区别于竞品"厚重油腻、矿物油+色粉"</p>
                <p>• <b>目标客群</b>：细软发/染烫受损/追求干净成分女性（高复购），竞品1适合粗硬干枯发</p>
                <p>• <b>标题关键词</b>："масло для волос"（护发精油）、"без минерального масла"（无矿物油）、"термозащита"（防热损伤）、"лёгкое"（轻盈）、"50мл/100мл/150мл"</p>
                <p>• <b>季节策略</b>：全年可售，夏季防热损伤（吹风/日晒）、冬季防干燥，搭配发膜做套装促销</p>
                <p>• <b>一句话总结</b>：俄罗斯护发精油竞品普遍以硅油体系为主，功效集中在顺滑与光泽；低价款通过"成分表豪华化"制造高端感，高价款通过香型与包装溢价。我方最有效的差异化方向是<b>"轻盈不塌 + 不含矿物油/色素 + 高端修护叙事"</b></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {stats.isGlovesCategory && stats.nitrileGlovesData && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🧤 丁腈手套专项分析</h3>
          <div className="grid grid-cols-5 gap-3 mb-6">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.nitrileGlovesData.total}</div>
              <div className="text-xs text-blue-600">丁腈手套商品数</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.nitrileGlovesData.shareOfCategory}%</div>
              <div className="text-xs text-green-600">占类目比例</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-700">¥{fmtCNY(stats.nitrileGlovesData.totalSales)}</div>
              <div className="text-xs text-purple-600">总销售额</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-700">{stats.nitrileGlovesData.totalQty?.toLocaleString()}</div>
              <div className="text-xs text-orange-600">总销量(件)</div>
            </div>
            <div className="bg-pink-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-pink-700">₽{Math.round(stats.nitrileGlovesData.avgPrice).toLocaleString()}</div>
              <div className="text-xs text-pink-600">平均单价</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🎨 颜色分布</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.nitrileGlovesData.colorData.slice(0, 6)} layout="vertical" margin={{ left: 50 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n) => n === 'sales' ? `¥${fmtCNYFull(v)}` : n === 'qty' ? `${v}件` : v} />
                  <Bar dataKey="qty" fill="#8B9DC3" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">颜色</th><th className="px-2 py-1 text-right">销量(件)</th><th className="px-2 py-1 text-right">销量占比</th></tr></thead>
                  <tbody>
                    {stats.nitrileGlovesData.colorData.slice(0, 5).map((c, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{c.name}</td>
                        <td className="px-2 py-1 text-right font-semibold">{c.qty?.toLocaleString()}</td>
                        <td className="px-2 py-1 text-right">{c.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">📏 尺码分布</h4>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={stats.nitrileGlovesData.sizeData} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n) => n === 'qty' ? `${v}件` : n === 'count' ? `${v}款` : v} />
                  <Bar dataKey="qty" fill="#D4A5A5" name="销量" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">尺码</th><th className="px-2 py-1 text-right">销量(件)</th><th className="px-2 py-1 text-right">销量占比</th></tr></thead>
                  <tbody>
                    {stats.nitrileGlovesData.sizeData.map((s, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{s.name}</td>
                        <td className="px-2 py-1 text-right font-semibold">{s.qty?.toLocaleString()}</td>
                        <td className="px-2 py-1 text-right">{s.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">📦 包装规格</h4>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={stats.nitrileGlovesData.packData} cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={2} dataKey="count" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {stats.nitrileGlovesData.packData.map((_, i) => <Cell key={i} fill={CC[i % CC.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n, p) => [`${v}款 (${p.payload.qty?.toLocaleString()}件)`, p.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50"><th className="px-2 py-1 text-left">规格</th><th className="px-2 py-1 text-right">销量(件)</th><th className="px-2 py-1 text-right">销量占比</th></tr></thead>
                  <tbody>
                    {stats.nitrileGlovesData.packData.map((p, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-2 py-1 font-medium">{p.name}</td>
                        <td className="px-2 py-1 text-right font-semibold">{p.qty?.toLocaleString()}</td>
                        <td className="px-2 py-1 text-right">{p.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">🏥 用途场景分布</h4>
              <div className="flex flex-wrap gap-2">
                {stats.nitrileGlovesData.useData.map((u, i) => (
                  <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-800 rounded-full text-xs font-medium">
                    {u.name} <span className="font-normal">({u.count}款)</span>
                  </span>
                ))}
              </div>
              {stats.nitrileGlovesData.useData.length === 0 && (
                <p className="text-xs text-morandi-text-light">未识别到明确用途标签</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-morandi-text mb-3">💰 价格区间分布</h4>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={stats.nitrileGlovesData.priceData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v, n, p) => [`${v}款 (${p.payload.qty?.toLocaleString()}件, 均₽${Math.round(p.payload.avgPrice)})`, '商品数']} />
                  <Bar dataKey="qty" fill="#C3B4D1" name="销量" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-semibold text-morandi-text mb-3">🏆 TOP 10 丁腈手套品牌</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">排名</th><th className="px-2 py-2 text-left">品牌</th><th className="px-2 py-2 text-right">商品数</th><th className="px-2 py-2 text-right">销量</th><th className="px-2 py-2 text-right">销售额(¥)</th></tr></thead>
                <tbody>
                  {stats.nitrileGlovesData.brandData.map((b, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-2 py-2"><span className={`inline-block w-5 h-5 rounded-full text-xs text-center leading-5 ${i < 3 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                      <td className="px-2 py-2 font-medium">{b.name}</td>
                      <td className="px-2 py-2 text-right">{b.count}</td>
                      <td className="px-2 py-2 text-right">{b.qty?.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right font-medium">¥{fmtCNYFull(b.sales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="text-sm font-semibold text-morandi-text mb-3">🔥 热销商品 TOP 10（按销量）</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">排名</th><th className="px-2 py-2 text-left">商品名称</th><th className="px-2 py-2 text-center">颜色</th><th className="px-2 py-2 text-center">尺码</th><th className="px-2 py-2 text-center">规格</th><th className="px-2 py-2 text-center">场景</th><th className="px-2 py-2 text-center">发货</th><th className="px-2 py-2 text-right">单价(₽)</th><th className="px-2 py-2 text-right">单只价(₽)</th><th className="px-2 py-2 text-right">销量</th><th className="px-2 py-2 text-right">预估利润率</th></tr></thead>
                <tbody>
                  {stats.nitrileGlovesData.topProducts.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-2 py-2"><span className={`inline-block w-5 h-5 rounded-full text-xs text-center leading-5 ${i < 3 ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                      <td className="px-2 py-2 font-medium max-w-[250px] truncate" title={p.name}>{p.name}</td>
                      <td className="px-2 py-2 text-center">{p._color ? <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{p._color}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-center">{p._size ? <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">{p._size}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-center">{p._pack ? <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">{p._pack}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-center">{p._use ? <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-xs">{p._use}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-center">{p._shipType ? <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${p._shipType === 'FBO' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{p._shipType}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-right font-medium">₽{Math.round(p.price).toLocaleString()}</td>
                      <td className="px-2 py-2 text-right font-medium">{p._pricePerPiece ? <span className="text-indigo-600">₽{p._pricePerPiece}</span> : <span className="text-gray-300">-</span>}</td>
                      <td className="px-2 py-2 text-right font-bold text-red-600">{p.qty?.toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">
                        {p._grossRate ? (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${parseFloat(p._grossRate) >= 20 ? 'bg-green-100 text-green-700' : parseFloat(p._grossRate) >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                            {p._grossRate}%
                          </span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-morandi-text flex items-center gap-2">
                <span className="text-lg">🎯</span> 我方产品竞争雷达图{stats.competitorAnalysis?.compIs100pcs && <span className="text-[10px] text-amber-600 ml-1">（基于{stats.competitorAnalysis?.compProductCount}款100只装产品）</span>}
              </h4>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>我方产品</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-300 inline-block"></span>市场平均</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart outerRadius={110} data={stats.competitorAnalysis?.radarData || []}>
                    <PolarGrid stroke="#e0e0e0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                    <Radar name="市场平均" dataKey="avg" stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.15} strokeWidth={1.5} strokeDasharray="4 4" />
                    <Radar name="我方产品" dataKey="us" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.25} strokeWidth={2} />
                    <Tooltip formatter={(v, name, props) => {
                      const note = name === '我方产品' ? props.payload?.usNote : props.payload?.avgNote
                      return [`${v}分（${note}）`, name]
                    }} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <h5 className="text-xs font-bold text-blue-700 mb-2">我方产品参数</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between"><span className="text-morandi-text-light">采购成本</span><span className="font-bold text-morandi-text">¥38/盒(100只)</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">Ozon手续费</span><span className="font-bold text-morandi-text">12%</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">物流费</span><span className="font-bold text-morandi-text">¥20/单</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">单只克重</span><span className="font-bold text-morandi-text">8.5g（高克重）</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">颜色</span><span className="font-bold text-morandi-text">🟢黑色 🟠橙色</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">尺码</span><span className="font-bold text-morandi-text">M码</span></div>
                    <div className="flex justify-between col-span-2"><span className="text-morandi-text-light">定位</span><span className="font-bold text-morandi-text">重型防滑手套 | 非一次性 | 双面防滑 | 无乳胶</span></div>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-green-100">
                  <h5 className="text-xs font-bold text-green-700 mb-2">💰 利润测算（实际售价）</h5>
                  <div className="space-y-1 text-xs border-b border-gray-100 pb-2 mb-2">
                    <div className="text-[10px] font-bold text-gray-500 mb-1">50只装 Safe Grip ₽{stats.competitorAnalysis?.ourPrice50}</div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">售价</span><span className="font-bold">₽{stats.competitorAnalysis?.ourPrice50} ≈ ¥{(stats.competitorAnalysis?.ourPrice50 * R).toFixed(1)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">采购成本（50只）</span><span className="text-red-500">-¥{stats.competitorAnalysis?.ourPurchase50}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">物流费</span><span className="text-red-500">-¥{stats.competitorAnalysis?.ourLogistics50}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">Ozon手续费(12%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.ozonFee50} ≈ -¥{(stats.competitorAnalysis?.ozonFee50 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">广告费(10%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.adFee50} ≈ -¥{(stats.competitorAnalysis?.adFee50 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">汇损(1%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.exchangeLoss50} ≈ -¥{(stats.competitorAnalysis?.exchangeLoss50 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">售后(3%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.afterSales50} ≈ -¥{(stats.competitorAnalysis?.afterSales50 * R).toFixed(2)}</span></div>
                    <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span>净利润/单</span><span className={parseFloat(stats.competitorAnalysis?.profit50) >= 0 ? 'text-green-600' : 'text-red-600'}>¥{stats.competitorAnalysis?.profit50}（{stats.competitorAnalysis?.profitRate50}%）</span></div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="text-[10px] font-bold text-gray-500 mb-1">100只装 Steel Grip ₽{stats.competitorAnalysis?.ourPrice100}</div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">售价</span><span className="font-bold">₽{stats.competitorAnalysis?.ourPrice100} ≈ ¥{(stats.competitorAnalysis?.ourPrice100 * R).toFixed(1)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">采购成本</span><span className="text-red-500">-¥{stats.competitorAnalysis?.ourCostCNY}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">物流费</span><span className="text-red-500">-¥{stats.competitorAnalysis?.ourLogistics}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">Ozon手续费(12%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.ozonFee100} ≈ -¥{(stats.competitorAnalysis?.ozonFee100 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">广告费(10%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.adFee100} ≈ -¥{(stats.competitorAnalysis?.adFee100 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">汇损(1%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.exchangeLoss100} ≈ -¥{(stats.competitorAnalysis?.exchangeLoss100 * R).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">售后(3%)</span><span className="text-red-500">-₽{stats.competitorAnalysis?.afterSales100} ≈ -¥{(stats.competitorAnalysis?.afterSales100 * R).toFixed(2)}</span></div>
                    <div className="border-t border-gray-100 pt-1 flex justify-between font-bold"><span className="text-morandi-text">净利润/单</span><span className={parseFloat(stats.competitorAnalysis?.profit100) >= 0 ? 'text-green-600' : 'text-red-600'}>¥{stats.competitorAnalysis?.profit100} {parseFloat(stats.competitorAnalysis?.profit100) < 0 && '⚠️'}</span></div>
                    <div className="flex justify-between"><span className="text-morandi-text-light">净利率</span><span className={`font-bold ${parseFloat(stats.competitorAnalysis?.profitRate100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.competitorAnalysis?.profitRate100}%</span></div>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-1.5 bg-amber-50 rounded px-2 py-1">💡 费用结构：Ozon 12% + 广告 10% + 汇损 1% + 售后 3% = 合计26%平台运营费。我方为<b>重型防滑手套</b>，非一次性产品，高克重8.5g支撑溢价</p>
                </div>

                <div className="bg-white rounded-lg p-3 border border-purple-100">
                  <h5 className="text-xs font-bold text-purple-700 mb-2">📊 竞争力分析</h5>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>产品质量95分</b>：8.5g高克重远超市场5-6g，耐用性碾压同类</span></div>
                    <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>合规认证80分</b>：无乳胶过敏是差异化卖点，医疗/美容场景加分</span></div>
                    <div className="flex items-start gap-1.5"><span className="text-green-500 mt-0.5">✓</span><span><b>供货稳定90分</b>：国内采购稳定，无断货风险</span></div>
                    <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>市场熟悉度50分</b>：需积累俄文评价和店铺评分</span></div>
                    <div className="flex items-start gap-1.5"><span className="text-amber-500 mt-0.5">⚠</span><span><b>品牌故事65分</b>：需包装"中国智造+高克重耐用"故事</span></div>
                  </div>
                  <div className="mt-2 bg-amber-50 rounded px-2 py-1.5 text-[10px] text-amber-700 border border-amber-200">
                    ⚡ <b>重型防滑手套</b>：我方产品为重型防滑手套，非一次性产品！8.5g高克重+双面防滑，与市场5-6g薄款一次性手套形成代差，价格偏高合理
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <h4 className="text-sm font-semibold text-morandi-text mb-4 flex items-center gap-2">
              <span className="text-lg">⚔️</span> 我方产品 vs {stats.competitorAnalysis?.compIs100pcs ? '100只装' : 'TOP10'}热销品 综合对比
            </h4>

            <div className="grid grid-cols-2 gap-6 mb-5">
              <div>
                <h5 className="text-xs font-bold text-morandi-text mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>我方产品（重型防滑手套，非一次性，8.5g高克重）
                </h5>
                <div className="bg-blue-50 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">实际售价</span><span className="font-bold text-blue-700">50只 ₽{stats.competitorAnalysis?.ourPrice50} / 100只 ₽{stats.competitorAnalysis?.ourPrice100}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">采购成本</span><span className="font-bold">¥{stats.competitorAnalysis?.ourCostCNY}/盒(100只)</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">克重</span><span className="font-bold text-green-600">8.5g（高克重重型）</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">100只装净利率</span><span className={`font-bold ${parseFloat(stats.competitorAnalysis?.profitRate100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.competitorAnalysis?.profitRate100}%</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">100只装净利润</span><span className={`font-bold ${parseFloat(stats.competitorAnalysis?.profit100) >= 0 ? 'text-green-600' : 'text-red-600'}`}>¥{stats.competitorAnalysis?.profit100}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">颜色</span><span className="font-bold">🟢黑色 🟠橙色</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">尺码</span><span className="font-bold">M码</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">规格</span><span className="font-bold">50只/100只</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">定位</span><span className="text-[10px] font-bold text-red-600">重型防滑手套 | 非一次性 | 双面防滑 | 无乳胶</span></div>
                </div>
              </div>

              <div>
                <h5 className="text-xs font-bold text-morandi-text mb-3 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>{stats.competitorAnalysis?.compIs100pcs ? '100只装' : 'TOP10'}热销品（{stats.competitorAnalysis?.compProductCount}款均价）
                </h5>
                <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-xs">
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">均价</span><span className="font-bold">₽{stats.competitorAnalysis?.top10AvgPrice}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">价格区间</span><span className="font-bold">₽{stats.competitorAnalysis?.top10MinPrice} - ₽{stats.competitorAnalysis?.top10MaxPrice}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">平均销量/品</span><span className="font-bold">{stats.competitorAnalysis?.top10AvgQty?.toLocaleString()}件</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">预估净利率</span><span className="font-bold text-amber-600">{stats.competitorAnalysis?.top10AvgGross}%</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">TOP颜色</span><span className="font-bold">{stats.competitorAnalysis?.top10Colors?.slice(0, 3).join('、') || '-'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">TOP尺码</span><span className="font-bold">{stats.competitorAnalysis?.top10Sizes?.slice(0, 3).join('、') || '-'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">TOP规格</span><span className="font-bold">{stats.competitorAnalysis?.top10Packs?.slice(0, 3).join('、') || '-'}</span></div>
                  <div className="flex justify-between items-center"><span className="text-morandi-text-light">发货方式</span><span className="font-bold">FBO {stats.competitorAnalysis?.top10FboRatio}% / FBS {stats.competitorAnalysis?.top10FbsRatio}%</span></div>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <h5 className="text-xs font-bold text-morandi-text mb-3">📊 多维度对比评分</h5>
              <div className="space-y-2">
                {[
                  { label: '产品质量（克重）', our: 95, top10: Math.min(70, 50 + Math.round(stats.competitorAnalysis?.top10AvgPricePerPiece || 0)), ourNote: '8.5g重型防滑', top10Note: '普通克重' },
                  { label: '价格竞争力', our: Math.round(Math.max(30, 100 - (stats.competitorAnalysis?.ourPrice100 / 100 / Math.max(parseFloat(stats.competitorAnalysis?.top10AvgPricePerPiece) || 0.1) - 1) * 50)), top10: 65, ourNote: `₽${(stats.competitorAnalysis?.ourPrice100 / 100).toFixed(1)}/只`, top10Note: `₽${stats.competitorAnalysis?.top10AvgPricePerPiece}/只` },
                  { label: '利润空间', our: parseFloat(stats.competitorAnalysis?.profitRate100 || 0) >= 15 ? 85 : 70, top10: parseFloat(stats.competitorAnalysis?.top10AvgGross || 0) >= 15 ? 80 : 65, ourNote: '净利率' + stats.competitorAnalysis?.profitRate100 + '%', top10Note: '净利率' + stats.competitorAnalysis?.top10AvgGross + '%' },
                  { label: '供货稳定性', our: 90, top10: 70, ourNote: '国内采购稳定', top10Note: '依赖本地供应' },
                  { label: '克重品质', our: 95, top10: 55, ourNote: '8.5g高克重', top10Note: '5-6g普通克重' },
                  { label: '合规认证', our: 80, top10: 55, ourNote: '无乳胶认证', top10Note: '认证参差不齐' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-morandi-text text-right">{item.label}</div>
                    <div className="flex-1 relative h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div className="absolute left-0 top-0 h-full bg-blue-500 rounded-full flex items-center justify-end pr-2" style={{ width: `${item.our}%` }}>
                        <span className="text-white text-[10px] font-bold">{item.our}</span>
                      </div>
                      <div className="absolute top-0 h-full rounded-full border-2 border-dashed border-gray-400" style={{ left: `${item.top10}%` }}>
                        <span className="absolute -top-4 text-[9px] text-gray-500 whitespace-nowrap">{item.top10}分</span>
                      </div>
                    </div>
                    <div className="w-4 text-center"><span className="text-blue-500 text-xs font-bold">↑</span></div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-morandi-text-light mt-2">蓝色条=我方产品 | 虚线=TOP10平均 | ↑表示我方占优</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-lg p-3">
                <h5 className="text-xs font-bold text-green-700 mb-2">✅ 我方优势</h5>
                <div className="space-y-1 text-[11px] text-green-700">
                  <p>• <b>重型防滑定位</b>：8.5g高克重双面防滑，非一次性产品，耐用性远超市场5-6g薄款</p>
                  <p>• <b>无乳胶过敏</b>：差异化卖点，医疗/美容/工业场景加分</p>
                  <p>• <b>成本优势</b>：¥38/100只，规模化后成本可控</p>
                  <p>• <b>供货稳定</b>：国内供应链稳定，无断货风险</p>
                  <p>• <b>实际验证</b>：50只₽{stats.competitorAnalysis?.ourPrice50}、100只₽{stats.competitorAnalysis?.ourPrice100}已在售，价格体系已验证</p>
                </div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <h5 className="text-xs font-bold text-amber-700 mb-2">⚠️ 我方劣势与应对</h5>
                <div className="space-y-1 text-[11px] text-amber-700">
                  <p>• <b>市场熟悉度低</b>：需积累俄文评价，建议送样给KOL测评</p>
                  <p>• <b>品牌认知为零</b>：需包装"重型防滑手套专家"故事，突出非一次性定位</p>
                  <p>• <b>价格偏高</b>：需强调重型防滑≠一次性，Listing中突出"8.5g高克重""双面防滑"差异化</p>
                  <p>• <b>物流成本</b>：¥20/单偏高，可考虑FBS降低物流成本</p>
                  <p>• <b>平台费用高</b>：Ozon12%+广告10%+汇损1%+售后3%=26%，需控制广告投放ROI</p>
                </div>
              </div>
            </div>

            <div className="mt-4 bg-blue-50 rounded-lg p-3">
              <h5 className="text-xs font-bold text-blue-800 mb-2">💡 综合建议</h5>
              <div className="text-xs text-blue-700 space-y-1">
                <p>• <b>产品定位</b>：重型防滑手套，非一次性产品！8.5g高克重+双面防滑，与市场5-6g薄款形成代差</p>
                <p>• <b>价格合理性</b>：100只₽{stats.competitorAnalysis?.ourPrice100}（¥{(stats.competitorAnalysis?.ourPrice100 * R).toFixed(0)}）看似偏高，但重型防滑手套单价应与一次性手套区分，强调"耐用=更划算"</p>
                <p>• <b>费用结构</b>：平台运营费合计26%（Ozon12%+广告10%+汇损1%+售后3%），100只装净利率{stats.competitorAnalysis?.profitRate100}%，50只装净利率{stats.competitorAnalysis?.profitRate50}%</p>
                <p>• 标题关键词：加入"8.5g"、"высокая плотность"（高密度）、"без латекса"（无乳胶）、"двойное покрытие"（双面涂层）、"многоразовые"（可重复使用）</p>
                <p>• 主图策略：突出克重数据对比，用数字"8.5g"做差异化卖点，附上一次性手套对比图强调耐用性</p>
                <p>• <b>溢价策略</b>：在Listing中强调"8.5g高克重=更耐用"、"双面防滑=更安全"、"非一次性=更划算"三大卖点，支撑高价位段定价</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <h5 className="text-sm font-semibold text-blue-800 mb-2">💡 丁腈手套选品建议</h5>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• 丁腈手套占类目 <strong>{stats.nitrileGlovesData.shareOfCategory}%</strong>，是手套类目的主力材质</p>
              {stats.nitrileGlovesData.colorData.length > 0 && (
                <p>• 最热颜色: <strong>{stats.nitrileGlovesData.colorData[0]?.name}</strong>，占比 {stats.nitrileGlovesData.colorData[0]?.share}%</p>
              )}
              {stats.nitrileGlovesData.sizeData.length > 0 && stats.nitrileGlovesData.sizeData[0]?.name !== '未标注' && (
                <p>• 最热尺码: <strong>{stats.nitrileGlovesData.sizeData[0]?.name}</strong>，建议主推此尺码</p>
              )}
              {stats.nitrileGlovesData.useData.length > 0 && (
                <p>• 主要用途: <strong>{stats.nitrileGlovesData.useData.slice(0, 3).map(u => u.name).join('、')}</strong></p>
              )}
              {stats.nitrileGlovesData.packData.length > 0 && (
                <p>• 热销规格: <strong>{stats.nitrileGlovesData.packData[0]?.name}</strong>，建议按此规格打包销售</p>
              )}
              <p>• 丁腈材质优势: 无乳胶过敏风险、耐化学腐蚀、触感灵敏，适合医疗、美容、清洁等多场景</p>
              <p>• 建议: 黑色/蓝色丁腈手套是市场主流，100只装是热销规格，可重点布局</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4">📈 功能关键词分布 (俄/英/中对照)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats.featureData.slice(0, 8)} layout="vertical">
            <XAxis type="number" />
            <YAxis type="category" dataKey="zh" width={70} tick={{ fontSize: 9 }} />
            <Tooltip formatter={(v) => [`¥${fmtCNYFull(v)}`, '销售额']} />
            <Bar dataKey="sales" fill="#C3B4D1" name="销售额" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-gray-50"><th className="px-2 py-2 text-left">中文</th><th className="px-2 py-2 text-left">俄语</th><th className="px-2 py-2 text-left">英语</th><th className="px-2 py-2 text-right">产品数</th><th className="px-2 py-2 text-right">销售额(¥)</th><th className="px-2 py-2 text-right">均价(¥)</th><th className="px-2 py-2 text-right">溢价</th><th className="px-2 py-2 text-left">说明</th></tr></thead>
            <tbody>
              {stats.featureData.map((f, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-2 py-2 font-medium">{f.zh}</td>
                  <td className="px-2 py-2 text-morandi-secondary italic">{f.ru}</td>
                  <td className="px-2 py-2 text-gray-600">{f.en}</td>
                  <td className="px-2 py-2 text-right">{f.count}</td>
                  <td className="px-2 py-2 text-right font-medium">¥{fmtCNYFull(f.sales)}</td>
                  <td className="px-2 py-2 text-right">¥{fmtCNYFull(f.avgPrice)}</td>
                  <td className="px-2 py-2 text-right">
                    {f.premium > 0 ? (
                      <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-xs">+{f.premium}%</span>
                    ) : f.premium < 0 ? (
                      <span className="px-1 py-0.5 bg-red-100 text-red-600 rounded text-xs">{f.premium}%</span>
                    ) : (
                      <span className="px-1 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">0%</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-morandi-text-light max-w-[150px] truncate">{f.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4">🔍 不同价格带产品功能分析</h3>
        <div className="space-y-4">
          {stats.priceBandFeatureData.map((band, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-morandi-primary/10 text-morandi-primary rounded-full text-sm font-medium">{band.band}</span>
                  <span className="text-xs text-morandi-text-light">{band.productCount}个商品</span>
                </div>
                <div className="flex gap-4 text-xs text-morandi-text-light">
                  <span>总销售额: <strong className="text-morandi-text">¥{fmtCNYFull(band.totalSales)}</strong></span>
                  <span>均价: <strong className="text-morandi-text">¥{Math.round(band.avgPrice * R).toLocaleString()}</strong></span>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {band.features.map((f, j) => (
                  <div key={j} className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-sm font-medium text-morandi-text">{f.name}</div>
                    <div className="text-xs text-morandi-secondary italic">{f.ru}</div>
                    <div className="text-xs text-morandi-text-light">{f.count}款 · 渗透率{f.penetration}%</div>
                    <div className="text-xs text-morandi-primary font-medium">¥{fmtCNYFull(f.avgPrice)}</div>
                  </div>
                ))}
                {band.features.length === 0 && <div className="col-span-5 text-xs text-morandi-text-light text-center py-2">该价格带无显著功能关键词</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-yellow-500" /> 销量TOP15产品</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">产品名称</th><th className="px-3 py-2 text-left">品牌</th><th className="px-3 py-2 text-right">价格(¥)</th><th className="px-3 py-2 text-right">销量</th><th className="px-3 py-2 text-right">销售额(¥)</th><th className="px-3 py-2 text-right">毛利率</th><th className="px-3 py-2 text-left">发货</th><th className="px-3 py-2 text-left">上架时间</th></tr></thead>
            <tbody>
              {stats.topProducts.map((p, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-3 py-2"><span className={`inline-block w-5 h-5 rounded-full text-xs flex items-center justify-center ${i < 3 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                  <td className="px-3 py-2 max-w-[200px]">
                    <div className="text-gray-700 truncate">{p.name}</div>
                    {p.zhTags.length > 0 && <div className="text-xs text-morandi-secondary">{p.zhTags.join(' · ')}</div>}
                  </td>
                  <td className="px-3 py-2 text-morandi-secondary font-medium">{p.brand}</td>
                  <td className="px-3 py-2 text-right">¥{Math.round(p.price * R).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-bold text-morandi-primary">{p.qty.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">¥{fmtCNYFull(p.sales)}</td>
                  <td className="px-3 py-2 text-right"><span className={`px-2 py-0.5 rounded text-xs ${p.gross != null && p.gross > 0 ? (p.gross > 30 ? 'bg-green-100 text-green-700' : p.gross > 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-500'}`}>{p.gross != null && p.gross > 0 ? `${p.gross.toFixed(1)}%` : '未知'}</span></td>
                  <td className="px-3 py-2 text-xs">{p.shipping}</td>
                  <td className="px-3 py-2 text-xs text-morandi-text-light">{p.date || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Truck className="w-5 h-5 text-blue-500" /> 📦 FBS发货方式销量TOP15</h3>
        {stats.fbsTopProducts && stats.fbsTopProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-100 bg-gray-50"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">产品名称</th><th className="px-3 py-2 text-left">品牌</th><th className="px-3 py-2 text-right">价格(¥)</th><th className="px-3 py-2 text-right">销量</th><th className="px-3 py-2 text-right">销售额(¥)</th><th className="px-3 py-2 text-right">毛利率</th><th className="px-3 py-2 text-left">发货模式</th><th className="px-3 py-2 text-left">上架时间</th></tr></thead>
              <tbody>
                {stats.fbsTopProducts.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2"><span className={`inline-block w-5 h-5 rounded-full text-xs flex items-center justify-center ${i < 3 ? 'bg-blue-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <div className="text-gray-700 truncate">{p.name}</div>
                      {p.zhTags.length > 0 && <div className="text-xs text-morandi-secondary">{p.zhTags.join(' · ')}</div>}
                    </td>
                    <td className="px-3 py-2 text-morandi-secondary font-medium">{p.brand}</td>
                    <td className="px-3 py-2 text-right">¥{Math.round(p.price * R).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-600">{p.qty.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">¥{fmtCNYFull(p.sales)}</td>
                    <td className="px-3 py-2 text-right"><span className={`px-2 py-0.5 rounded text-xs ${p.gross != null && p.gross > 0 ? (p.gross > 30 ? 'bg-green-100 text-green-700' : p.gross > 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-500'}`}>{p.gross != null && p.gross > 0 ? `${p.gross.toFixed(1)}%` : '未知'}</span></td>
                    <td className="px-3 py-2 text-xs">{p.shipping}</td>
                    <td className="px-3 py-2 text-xs text-morandi-text-light">{p.date || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 bg-blue-50 rounded-lg p-3">
              <div className="text-xs text-blue-700">
                <strong>FBS模式说明:</strong> FBS(卖家自发货)模式共{stats.fbsTopProducts.length}个产品，总销量{stats.fbsTopProducts.reduce((s, p) => s + p.qty, 0).toLocaleString()}件。
                适合有海外仓或本地发货能力的卖家。
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-morandi-text-light">暂无FBS发货方式的产品数据</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-morandi-primary" /> 🆕 新品分析 (180天内上架)</h3>
        {stats.newProducts180 && stats.newProducts180.length > 0 ? (
          <div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.newProductsStats.count}</div>
                <div className="text-xs text-green-500">新品数量</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.newProductsStats.totalQty.toLocaleString()}</div>
                <div className="text-xs text-blue-500">新品总销量</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">¥{fmtCNY(stats.newProductsStats.totalSales)}</div>
                <div className="text-xs text-purple-500">新品总销售额</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">¥{Math.round(stats.newProductsStats.avgPrice * R).toLocaleString()}</div>
                <div className="text-xs text-orange-500">新品平均价格</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 bg-gray-50"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">产品名称</th><th className="px-3 py-2 text-left">品牌</th><th className="px-3 py-2 text-right">价格(¥)</th><th className="px-3 py-2 text-right">销量</th><th className="px-3 py-2 text-right">销售额(¥)</th><th className="px-3 py-2 text-right">发货方式</th><th className="px-3 py-2 text-right">上架日期</th></tr></thead>
                    <tbody>
                      {stats.newProducts180.map((p, i) => (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-3 py-2"><span className={`inline-block w-5 h-5 rounded-full text-xs flex items-center justify-center ${i < 3 ? 'bg-green-400 text-white' : 'bg-gray-100 text-gray-600'}`}>{i + 1}</span></td>
                          <td className="px-3 py-2 max-w-[200px]">
                            <div className="text-gray-700 truncate">{p.name}</div>
                            {p.zhTags.length > 0 && <div className="text-xs text-morandi-secondary">{p.zhTags.join(' · ')}</div>}
                          </td>
                          <td className="px-3 py-2 text-morandi-secondary font-medium">{p.brand}</td>
                          <td className="px-3 py-2 text-right">¥{Math.round(p.price * R).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-bold text-green-600">{p.qty.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">¥{fmtCNYFull(p.sales)}</td>
                          <td className="px-3 py-2 text-xs">{p.shipping}</td>
                          <td className="px-3 py-2 text-xs text-morandi-text-light">{p.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-morandi-text-light font-medium mb-2">🏷️ 新品品牌分布</div>
                  <div className="flex flex-wrap gap-1">
                    {stats.newProductsStats.topBrands.map((b, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">{b}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-morandi-text-light font-medium mb-2">💰 新品价格带分布</div>
                  <div className="space-y-1">
                    {stats.newProductsStats.priceBandDist.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-morandi-text">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-morandi-primary rounded-full" style={{ width: `${(p.count / stats.newProductsStats.count * 100)}%` }} />
                          </div>
                          <span className="text-morandi-text-light w-8 text-right">{p.count}个</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <div className="text-xs text-green-600 font-medium mb-1">💡 新品洞察</div>
                  <div className="text-xs text-green-700">
                    {stats.newProducts180.length > 0 ? (
                      <>
                        近180天上架新品{stats.newProductsStats.count}个，占总量{(stats.newProductsStats.count / stats.productCount * 100).toFixed(1)}%。
                        销量最高为{stats.newProducts180[0]?.brand}品牌，定价¥{Math.round(stats.newProducts180[0]?.price * R).toLocaleString()}。
                        新品均价¥{Math.round(stats.newProductsStats.avgPrice * R).toLocaleString()}
                        {stats.newProductsStats.avgPrice * R > stats.avgPrice * R ? '，高于' : '，低于'}市场均价¥{Math.round(stats.avgPrice * R).toLocaleString()}。
                      </>
                    ) : '暂无新品数据'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-morandi-text-light">暂无180天内上架的新品数据</p>
            <p className="text-xs text-morandi-text-light mt-1">请确认数据中包含"商品卡创建日期"字段</p>
          </div>
        )}
      </div>

      {/* 运营策略分析板块 */}
      {stats.operationStrategy && (stats.operationStrategy.promoStats.count > 0 || stats.operationStrategy.adStats.count > 0) && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span> 运营策略分析 (促销 & 推广)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {/* 促销策略分析 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-morandi-text mb-2">🎯 促销策略</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-red-600">{stats.operationStrategy.promoStats.count}</div>
                  <div className="text-xs text-red-500">参与促销产品</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-orange-600">{stats.operationStrategy.promoStats.highDiscount}</div>
                  <div className="text-xs text-orange-500">高折扣(≥20%)</div>
                </div>
              </div>
              {stats.operationStrategy.promoEffect && (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">平均折扣:</span>
                    <span className="font-medium">{stats.operationStrategy.promoEffect.avgDiscount.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">平均促销天数:</span>
                    <span className="font-medium">{stats.operationStrategy.promoEffect.avgPromoDays.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">促销产品均销:</span>
                    <span className="font-medium">{Math.round(stats.operationStrategy.promoEffect.avgSales).toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                <div className="text-xs text-red-700">
                  <strong>促销建议:</strong> {stats.operationStrategy.promoStats.count > stats.productCount * 0.5 ? '促销竞争激烈，建议差异化促销时机' : '促销参与度不高，有促销红利机会'}
                </div>
              </div>
            </div>
            
            {/* 推广策略分析 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-morandi-text mb-2">📢 推广策略</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.operationStrategy.adStats.count}</div>
                  <div className="text-xs text-blue-500">参与推广产品</div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-indigo-600">{stats.operationStrategy.adStats.highDuration}</div>
                  <div className="text-xs text-indigo-500">长期推广(≥50%)</div>
                </div>
              </div>
              {stats.operationStrategy.adEffect && (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">平均推广天数:</span>
                    <span className="font-medium">{stats.operationStrategy.adEffect.avgAdDays.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">推广产品均销:</span>
                    <span className="font-medium">{Math.round(stats.operationStrategy.adEffect.avgSales).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-morandi-text-light">平均广告费用:</span>
                    <span className="font-medium">¥{fmtCNY(stats.operationStrategy.adEffect.avgAdCost)}</span>
                  </div>
                </div>
              )}
              <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                <div className="text-xs text-blue-700">
                  <strong>推广建议:</strong> {stats.operationStrategy.adStats.count > stats.productCount * 0.5 ? '推广竞争激烈，需优化投放效率' : '推广参与度不高，有广告红利机会'}
                </div>
              </div>
            </div>
            
            {/* 最佳实践 */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-morandi-text mb-2">🏆 高销产品运营策略</div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {stats.operationStrategy.bestPractice.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                    <div className="min-w-0">
                      <span className="text-morandi-text truncate block">{p.name}</span>
                      <span className="text-morandi-secondary">{p.strategy}</span>
                    </div>
                    <span className="font-bold text-morandi-primary ml-2">{p.qty.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                <div className="text-xs text-green-700">
                  <strong>策略洞察:</strong> {stats.operationStrategy.insight}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-green-500" /> 高潜力产品TOP10</h3>
          <div className="mb-3 bg-green-50 rounded-lg p-2 border border-green-200">
            <div className="text-xs text-green-700">
              <strong>📐 潜力指数计算方法:</strong> 综合指数 {'='} 销量×0.4 {'+'} 潜力指数原始值×0.6。原始潜力指数来自数据表，按(销量×0.3 {'+'} 曝光量×0.3 {'+'} 转化率×0.4)综合计算
            </div>
          </div>
          <div className="space-y-2">
            {stats.highPotential.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <span className="text-sm text-morandi-text truncate block">{p.name.slice(0, 25)}</span>
                    {p.zhTags.length > 0 && <span className="text-xs text-morandi-secondary">{p.zhTags.slice(0, 2).join(' · ')}</span>}
                    <span className="text-xs text-green-600 font-medium">✓ {p.selectReason}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="font-bold text-morandi-primary">{p.qty > 0 ? p.qty.toLocaleString() : (p.potential || 0).toFixed(0)}</div>
                  <div className="text-xs text-morandi-text-light">销量</div>
                  <div className="font-bold text-green-600 text-sm">¥{Math.round(p.price * R).toLocaleString()}</div>
                  <div className="text-xs text-morandi-text-light">售价</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-purple-500" /> 真空地带产品 (高价高销)</h3>
          <div className="mb-3 bg-purple-50 rounded-lg p-2 border border-purple-200">
            <div className="text-xs text-purple-700">
              <strong>📐 筛选条件:</strong> 价格 {'>'} 市场均价 且 销量 {'>'} 市场平均销量。代表高价高销的蓝海市场，竞争较少但要求产品有足够竞争力
            </div>
          </div>
          <div className="space-y-2">
            {stats.vacuumZone.length > 0 ? stats.vacuumZone.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-full bg-purple-200 text-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm text-morandi-text truncate">{p.name.slice(0, 20)}</p>
                    {p.zhTags.length > 0 && <p className="text-xs text-morandi-secondary">{p.zhTags.slice(0, 2).join(' · ')}</p>}
                    <span className="text-xs text-purple-600 font-medium">✓ {p.selectReason}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="font-bold text-purple-600">{p.qty.toLocaleString()}</div>
                  <div className="text-xs text-purple-400">销量</div>
                  <div className="font-bold text-purple-700 text-sm">¥{Math.round(p.price * R).toLocaleString()}</div>
                  <div className="text-xs text-purple-400">售价</div>
                </div>
              </div>
            )) : <p className="text-center text-morandi-text-light py-8">暂无高价高销量产品</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">📈 价格-销量散点图 (蓝海识别)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
              <XAxis dataKey="price" name="价格" tickFormatter={(v) => `¥${Math.round(v * R)}`} tick={{ fontSize: 10 }} />
              <YAxis dataKey="qty" name="销量" tick={{ fontSize: 10 }} />
              <Tooltip content={({ active, payload }) => active && payload?.length ? (
                <div className="bg-white p-2 shadow-lg rounded text-xs">
                  <p className="font-medium">{payload[0].payload.name}</p>
                  <p>价格: ¥{Math.round(payload[0].payload.price * R).toLocaleString()}</p>
                  <p>销量: {payload[0].payload.qty.toLocaleString()}</p>
                </div>
              ) : null} />
              <Scatter data={stats.priceElasticity.slice(0, 50)} fill="#8B9DC3" />
            </ScatterChart>
          </ResponsiveContainer>
          <div className="mt-3 bg-blue-50 rounded-lg p-3">
            <div className="text-xs text-blue-700">
              <strong>💡 分析洞察:</strong> {stats.priceScatterAnalysis.insight}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🔍 价格带销量分析</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-xs text-green-600 mb-1">低价区 (30%)</div>
                <div className="text-lg font-bold text-green-700">{stats.priceScatterAnalysis.lowPrice.count}个</div>
                <div className="text-xs text-green-600">均销{Math.round(stats.priceScatterAnalysis.lowPrice.avgQty).toLocaleString()}</div>
                <div className="text-xs text-green-500">¥{Math.round(stats.priceScatterAnalysis.lowPrice.avgPrice * R).toLocaleString()}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xs text-blue-600 mb-1">中价区 (40%)</div>
                <div className="text-lg font-bold text-blue-700">{stats.priceScatterAnalysis.midPrice.count}个</div>
                <div className="text-xs text-blue-600">均销{Math.round(stats.priceScatterAnalysis.midPrice.avgQty).toLocaleString()}</div>
                <div className="text-xs text-blue-500">¥{Math.round(stats.priceScatterAnalysis.midPrice.avgPrice * R).toLocaleString()}</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-xs text-purple-600 mb-1">高价区 (30%)</div>
                <div className="text-lg font-bold text-purple-700">{stats.priceScatterAnalysis.highPrice.count}个</div>
                <div className="text-xs text-purple-600">均销{Math.round(stats.priceScatterAnalysis.highPrice.avgQty).toLocaleString()}</div>
                <div className="text-xs text-purple-500">¥{Math.round(stats.priceScatterAnalysis.highPrice.avgPrice * R).toLocaleString()}</div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-morandi-text-light font-medium mb-2">🎯 高销量低竞争产品 (蓝海机会)</div>
              {stats.priceScatterAnalysis.highSalesLowComp.length > 0 ? (
                <div className="space-y-1">
                  {stats.priceScatterAnalysis.highSalesLowComp.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-morandi-text truncate max-w-[150px]">{p.name.slice(0, 20)}</span>
                      <span className="text-morandi-secondary">¥{Math.round(p.price * R).toLocaleString()}</span>
                      <span className="font-bold text-green-600">{p.qty.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-morandi-text-light">暂无高销量低竞争产品</div>
              )}
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
              <div className="text-xs text-yellow-700">
                <strong>价格-销量相关系数:</strong> {stats.priceScatterAnalysis.priceCorrelation.toFixed(2)}
                <span className="ml-2">{Math.abs(stats.priceScatterAnalysis.priceCorrelation) < 0.3 ? '⚡ 弱相关' : stats.priceScatterAnalysis.priceCorrelation < 0 ? '📉 负相关' : '📈 正相关'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">💹 广告ROI TOP10 (高回报产品)</h3>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {stats.adEfficiency.slice(0, 10).map((p, i) => (
              <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-blue-50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i < 3 ? 'bg-yellow-400 text-white' : 'bg-blue-100 text-blue-600'}`}>{i + 1}</span>
                  <div className="min-w-0">
                    <span className="text-sm text-morandi-text truncate block font-medium">{p.name.slice(0, 20)}</span>
                    {p.zhTags.length > 0 && <span className="text-xs text-morandi-secondary">{p.zhTags.slice(0, 2).join(' · ')}</span>}
                    <span className="text-xs text-morandi-text-light block">广告占比{p.adRatio.toFixed(2)}% · 销售¥{fmtCNYFull(p.sales)}</span>
                  </div>
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <span className={`font-bold text-sm block ${p.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ROI {(p.roi * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-morandi-text-light">
                    {p.salesMultiple?.toFixed(1)}倍回报
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
            <strong>ROI计算:</strong> (销售额-广告费)/广告费，广告费=销售额×广告占比%。ROI&gt;0表示盈利
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">📊 高ROI产品策略分析</h3>
          {stats.adEfficiency.length > 0 ? (() => {
            const top10 = stats.adEfficiency.slice(0, 10)
            const avgRoi = top10.reduce((s, p) => s + p.roi, 0) / top10.length
            const avgAdRatio = top10.reduce((s, p) => s + p.adRatio, 0) / top10.length
            const avgPrice = top10.reduce((s, p) => s + p.price, 0) / top10.length
            const commonTags = {}
            top10.forEach(p => {
              p.zhTags.forEach(tag => {
                commonTags[tag] = (commonTags[tag] || 0) + 1
              })
            })
            const topTags = Object.entries(commonTags).sort((a, b) => b[1] - a[1]).slice(0, 3)
            const priceBand = avgPrice < 1000 ? '低价位' : avgPrice < 3000 ? '中价位' : '高价位'
            
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-green-600">{avgRoi === Infinity ? '∞' : `${(avgRoi * 100).toFixed(0)}%`}</div>
                    <div className="text-xs text-green-500">平均ROI</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-blue-600">{avgAdRatio.toFixed(2)}%</div>
                    <div className="text-xs text-blue-500">平均广告占比</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-purple-600">¥{Math.round(avgPrice * R).toLocaleString()}</div>
                    <div className="text-xs text-purple-500">平均售价</div>
                  </div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-morandi-text-light font-medium mb-2">🏷️ 高ROI产品共同特征</div>
                  <div className="flex flex-wrap gap-1">
                    {topTags.map(([tag, count], i) => (
                      <span key={i} className="px-2 py-1 bg-morandi-primary/10 text-morandi-primary rounded text-xs">{tag} ({count}/10)</span>
                    ))}
                    {topTags.length === 0 && <span className="text-xs text-morandi-text-light">暂无共同特征</span>}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-xs text-morandi-text-light font-medium">💡 策略建议</div>
                  <div className="p-2 rounded-lg border-l-4 border-green-500 bg-green-50">
                    <div className="text-xs text-green-700">
                      <strong>定价策略:</strong> 高ROI产品集中在{priceBand}区间(¥{Math.round(avgPrice * R).toLocaleString()})，建议新品的定价参考此区间
                    </div>
                  </div>
                  <div className="p-2 rounded-lg border-l-4 border-blue-500 bg-blue-50">
                    <div className="text-xs text-blue-700">
                      <strong>广告投放:</strong> 平均广告占比{avgAdRatio.toFixed(2)}%即可实现高回报，{avgAdRatio < 5 ? '属于低投入高回报模式' : avgAdRatio < 10 ? '属于中等投入模式' : '需要较高广告投入'}，建议控制在此范围内
                    </div>
                  </div>
                  <div className="p-2 rounded-lg border-l-4 border-purple-500 bg-purple-50">
                    <div className="text-xs text-purple-700">
                      <strong>产品差异化:</strong> {topTags.length > 0 ? `TOP10高ROI产品中${topTags[0][0]}出现${topTags[0][1]}次，是该品类的核心竞争力` : '建议通过功能差异化提升ROI'}
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-200">
                  <div className="text-xs text-yellow-700">
                    <strong>⚠️ 风险提示:</strong> {avgRoi > 2 ? '当前高ROI产品回报率极高，可能面临竞争加剧风险，建议尽快建立品牌壁垒' : avgRoi > 0.5 ? 'ROI表现良好，可持续投入' : 'ROI相对较低，需优化广告效率或提升客单价'}
                  </div>
                </div>
              </div>
            )
          })() : (
            <div className="text-center py-8 text-morandi-text-light">暂无广告ROI数据</div>
          )}
        </div>
      </div>

      {/* 无广告投入高销产品板块 */}
      {stats.noAdHighSales && stats.noAdHighSales.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2">
            <span className="text-2xl">🌟</span> 无广告投入高销产品TOP10 (自然流量爆款)
          </h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {stats.noAdHighSales.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg hover:from-green-100 hover:to-emerald-100 transition-colors border border-green-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i < 3 ? 'bg-green-500 text-white' : 'bg-green-200 text-green-700'}`}>{i + 1}</span>
                      <div className="min-w-0">
                        <span className="text-sm text-morandi-text truncate block font-medium">{p.name.slice(0, 22)}</span>
                        {p.zhTags.length > 0 && <span className="text-xs text-morandi-secondary">{p.zhTags.slice(0, 2).join(' · ')}</span>}
                        <span className="text-xs text-morandi-text-light block">{p.brand} · ¥{Math.round(p.price * R).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="font-bold text-green-600">{p.qty.toLocaleString()}</div>
                      <div className="text-xs text-green-500">销量</div>
                      <div className="font-bold text-emerald-600 text-sm">¥{fmtCNYFull(p.sales)}</div>
                      <div className="text-xs text-emerald-500">销售额</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.noAdHighSales.length}</div>
                  <div className="text-xs text-green-500">无广告高销产品</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{stats.noAdHighSales.reduce((s, p) => s + p.qty, 0).toLocaleString()}</div>
                  <div className="text-xs text-emerald-500">总销量</div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-morandi-text-light font-medium mb-2">🏷️ 共同特征</div>
                {(() => {
                  const tagCount = {}
                  stats.noAdHighSales.forEach(p => {
                    p.zhTags.forEach(tag => { tagCount[tag] = (tagCount[tag] || 0) + 1 })
                  })
                  const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 3)
                  return (
                    <div className="flex flex-wrap gap-1">
                      {topTags.map(([tag, count], i) => (
                        <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">{tag} ({count}/10)</span>
                      ))}
                      {topTags.length === 0 && <span className="text-xs text-morandi-text-light">暂无共同特征</span>}
                    </div>
                  )
                })()}
              </div>
              
              <div className="space-y-2">
                <div className="text-xs text-morandi-text-light font-medium">💡 成功因素分析</div>
                <div className="p-2 rounded-lg border-l-4 border-green-500 bg-green-50">
                  <div className="text-xs text-green-700">
                    <strong>自然流量优势:</strong> 这些产品零广告投入却获得高销量，说明具备强大的自然搜索排名或口碑传播能力
                  </div>
                </div>
                <div className="p-2 rounded-lg border-l-4 border-blue-500 bg-blue-50">
                  <div className="text-xs text-blue-700">
                    <strong>产品竞争力:</strong> {(() => {
                      const avgPrice = stats.noAdHighSales.reduce((s, p) => s + p.price, 0) / stats.noAdHighSales.length
                      return `平均售价¥${Math.round(avgPrice * R).toLocaleString()}，${avgPrice < stats.avgPrice ? '低于市场均价，价格竞争力强' : '高于市场均价，品质/品牌溢价能力强'}`
                    })()}
                  </div>
                </div>
                <div className="p-2 rounded-lg border-l-4 border-purple-500 bg-purple-50">
                  <div className="text-xs text-purple-700">
                    <strong>学习借鉴:</strong> 建议分析这些产品的标题关键词、主图设计、评价管理策略，复制其成功模式
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 rounded-lg p-2 border border-yellow-200">
                <div className="text-xs text-yellow-700">
                  <strong>⚠️ 注意:</strong> 无广告产品依赖自然流量，需持续优化SEO和用户体验，防止排名下滑
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">📊 品牌市场份额</h3>
          <div className="space-y-3">
            {stats.topBrands.slice(0, 5).map((brand) => (
              <div key={brand.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{brand.name}</span>
                  <span className="text-morandi-text-light">{brand.share}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-morandi-primary to-morandi-secondary rounded-full" style={{ width: `${brand.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🎯 核心运营指标</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">¥{Math.round(stats.avgPrice * R).toLocaleString()}</div>
              <div className="text-xs text-blue-500">平均客单价</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.avgGross != null && stats.avgGross > 0 ? `${stats.avgGross.toFixed(1)}%` : '未知'}</div>
              <div className="text-xs text-green-500">平均毛利率</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">¥{fmtCNY(stats.totalAdCost)}</div>
              <div className="text-xs text-purple-500">广告总投入</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.avgCartRate?.toFixed(2)}%</div>
              <div className="text-xs text-orange-500">加购转化率</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🚀 新品进入机会分析</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
              <div>
                <div className="text-sm text-morandi-text-light">市场竞争格局</div>
                <div className="text-xl font-bold text-green-600">{stats.marketPower}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-morandi-text-light">HHI指数</div>
                <div className="text-xl font-bold text-morandi-primary">{stats.hhi.toFixed(0)}</div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-morandi-text-light mb-2">💎 蓝海价格带机会</div>
              {stats.underservedPrices.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stats.underservedPrices.map((p, i) => (
                    <span key={i} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">¥{Math.round(p.price * R)} (±¥{Math.round(300 * R)}) 仅{p.count}个竞品</span>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-morandi-text-light">各价格带竞争较充分</span>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs text-morandi-text-light font-medium">📋 进入建议</div>
              <div className="p-3 rounded-lg border-l-4 border-blue-500 bg-blue-50">
                <div className="font-medium text-sm text-morandi-text">价格空白</div>
                <div className="text-xs text-morandi-text-light mt-1">{stats.underservedPrices.length > 0 ? `建议在¥${Math.round(stats.underservedPrices[0].price * R)}附近定价，竞争少` : '各价格带竞争较充分'}</div>
              </div>
              <div className="p-3 rounded-lg border-l-4 border-green-500 bg-green-50">
                <div className="font-medium text-sm text-morandi-text">功能空白</div>
                <div className="text-xs text-morandi-text-light mt-1">{stats.featureData.length > 0 ? `${stats.featureData[stats.featureData.length - 1]?.zh}功能竞品少，可差异化` : '功能覆盖较全'}</div>
              </div>
              <div className="p-3 rounded-lg border-l-4 border-purple-500 bg-purple-50">
                <div className="font-medium text-sm text-morandi-text">品牌机会</div>
                <div className="text-xs text-morandi-text-light mt-1">{stats.marketPower === '竞争型' ? '市场分散，适合新品牌进入' : `头部品牌占${stats.marketConcentration.toFixed(0)}%市场`}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-morandi-text mb-4">🏛️ 市场竞争垄断度分析</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-xs text-red-500">Top1品牌</div>
                <div className="font-bold text-red-600">{stats.topBrands[0]?.name || '-'}</div>
                <div className="text-sm text-red-400">{stats.topBrands[0]?.share || 0}%</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-xs text-orange-500">Top3品牌</div>
                <div className="font-bold text-orange-600">{stats.marketConcentration?.toFixed(1) || 0}%</div>
                <div className="text-sm text-orange-400">市场份额</div>
              </div>
            </div>
            <div className="text-xs text-morandi-text-light font-medium">🏆 品牌层级与壁垒</div>
            <div className="space-y-2">
              {stats.brandPower?.slice(0, 6).map((brand, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-yellow-400 text-white' : i < 3 ? 'bg-orange-400 text-white' : 'bg-blue-400 text-white'}`}>{i + 1}</span>
                    <span className="text-sm font-medium">{brand.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${brand.powerLevel === '绝对龙头' ? 'bg-yellow-100 text-yellow-700' : brand.powerLevel === '强势品牌' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{brand.powerLevel}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${brand.barrierLevel === '高壁垒' ? 'bg-red-100 text-red-700' : brand.barrierLevel === '中壁垒' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{brand.barrierLevel}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-morandi-text-light mb-2">📊 垄断指数解读</div>
              <div className="text-sm">
                {stats.hhi > 2500 ? <span className="text-red-600">⚠️ 市场高度集中，头部品牌壁垒高，新进入者需要差异化突破</span> : stats.hhi > 1500 ? <span className="text-yellow-600">⚡ 市场中等集中，存在突围机会，建议聚焦细分人群</span> : <span className="text-green-600">✅ 市场分散竞争充分，新品牌有较好进入机会</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-morandi-text mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-morandi-primary" /> 💡 策略建议</h3>
        <div className="grid grid-cols-3 gap-4">
          <RecommendationCard title="💰 定价策略" content={(() => {
            const bestBand = stats.priceData.reduce((best, p) => {
              const ratio = p.count > 0 ? p.sales / p.count : 0
              return ratio > (best.ratio || 0) ? { ...p, ratio } : best
            }, {})
            const topSalesBand = [...stats.priceData].sort((a, b) => b.sales - a.sales)[0]
            return `建议定价${topSalesBand?.name || '¥75-375'}区间，该区间总销售额¥${fmtCNYFull(topSalesBand?.sales || 0)}，单品产出最高为${bestBand?.name || '中端'}区间`
          })()} color="blue" />
          <RecommendationCard title="📦 发货建议" content={(() => {
            const topShipping = [...stats.fbsFboChartData].sort((a, b) => b.qty - a.qty)[0]
            return topShipping ? `${topShipping.name}模式销量最高(${topShipping.qty.toLocaleString()}件)，建议优先选择${topShipping.name}以获取更多流量` : 'FBO+FBS模式占比最高，建议优先采用FBO+FBS'
          })()} color="green" />
          <RecommendationCard title="🎯 差异化" content={(() => {
            const topFeature = stats.featureData[0]
            const lowFeature = stats.featureData[stats.featureData.length - 1]
            return topFeature ? `${topFeature.zh}(${topFeature.count}款)最受欢迎，${lowFeature?.zh || ''}竞品少可差异化` : '功能覆盖较全'
          })()} color="purple" />
          <RecommendationCard title="📈 市场机会" content={`Top3品牌占${stats.marketConcentration?.toFixed(1)}%市场，${stats.marketConcentration > 60 ? '集中度高，需差异化突破' : stats.marketConcentration > 40 ? '中等集中，存在突围空间' : '市场分散，新品牌机会大'}`} color="orange" />
          <RecommendationCard title="⚡ 广告投放" content={(() => {
            const totalAdRatio = stats.totalSales > 0 ? (stats.totalAdCost / stats.totalSales * 100) : 0
            return `整体广告占比${totalAdRatio.toFixed(2)}%，${totalAdRatio > 10 ? '占比偏高，建议优化投放效率' : totalAdRatio > 5 ? '占比适中，高ROI产品可增加' : '占比较低，有加大投放空间'}`
          })()} color="red" />
          <RecommendationCard title="🎯 黑马机会" content={(() => {
            const vacuumCount = stats.vacuumZone.length
            const newCount = stats.newProducts180?.length || 0
            return `真空地带(高价高销)${vacuumCount}个蓝海机会，近180天新品${newCount}个${newCount > 0 ? '，新品有成功先例' : ''}`
          })()} color="teal" />
        </div>
      </div>

      <div className="bg-gradient-to-r from-morandi-primary/10 to-morandi-secondary/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-morandi-text mb-4">🌟 市场进入策略建议</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border-l-4 border-morandi-primary">
            <h4 className="font-semibold text-morandi-text mb-2">💡 产品差异化</h4>
            <p className="text-sm text-morandi-text-light">{stats.featureData.length > 0 ? `基于数据TOP功能关键词"${stats.featureData[0]?.zh}"，重点配置热门功能，同时关注"${stats.featureData[stats.featureData.length - 1]?.zh}"等差异化方向` : '重点配置热门功能，打造差异化卖点'}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
            <h4 className="font-semibold text-morandi-text mb-2">⚡ 性能与品质</h4>
            <p className="text-sm text-morandi-text-light">俄罗斯消费者重视产品品质和耐用性，建议通过认证和品质保证提升信任度</p>
          </div>
          <div className="bg-white rounded-lg p-4 border-l-4 border-purple-500">
            <h4 className="font-semibold text-morandi-text mb-2">📦 发货与物流</h4>
            <p className="text-sm text-morandi-text-light">{stats.fbsFboChartData.length > 0 ? `市场主流发货方式为${[...stats.fbsFboChartData].sort((a, b) => b.qty - a.qty)[0]?.name}，建议新卖家优先选择以获取平台流量倾斜` : 'FBO+FBS模式可兼顾流量和灵活性'}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border-l-4 border-orange-500">
            <h4 className="font-semibold text-morandi-text mb-2">🔧 市场准入</h4>
            <p className="text-sm text-morandi-text-light">{stats.marketConcentration > 50 ? `市场集中度${stats.marketConcentration.toFixed(0)}%，头部壁垒高，建议从细分品类切入` : `市场集中度${stats.marketConcentration.toFixed(0)}%，竞争相对分散，有较好进入机会`}。必须符合EAC认证标准</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon, title, value, sub, trend }) {
  const colors = { up: 'text-green-600 bg-green-50', down: 'text-red-600 bg-red-50', neutral: 'text-gray-600 bg-gray-50' }
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[trend]}`}>{icon}</div>
        <div>
          <div className="text-xs text-morandi-text-light">{title}</div>
          <div className="text-lg font-bold text-morandi-text">{value}</div>
          <div className="text-xs text-morandi-text-light">{sub}</div>
        </div>
      </div>
    </div>
  )
}

function RecommendationCard({ title, content, color }) {
  const colors = { blue: 'border-l-blue-500 bg-blue-50', green: 'border-l-green-500 bg-green-50', purple: 'border-l-purple-500 bg-purple-50', orange: 'border-l-orange-500 bg-orange-50', red: 'border-l-red-500 bg-red-50', teal: 'border-l-teal-500 bg-teal-50' }
  return (
    <div className={`p-4 rounded-lg border-l-4 ${colors[color]}`}>
      <div className="font-semibold text-morandi-text mb-1">{title}</div>
      <div className="text-sm text-morandi-text-light">{content}</div>
    </div>
  )
}
