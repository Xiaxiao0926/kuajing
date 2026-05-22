import io
import os
from datetime import datetime
from fpdf import FPDF
from PIL import Image


MORANDI_COLORS = {
    'primary': (139, 157, 195),
    'secondary': (184, 169, 201),
    'accent': (212, 184, 160),
    'text': (74, 74, 74),
    'text_light': (122, 122, 122),
    'background': (246, 246, 246)
}


class MarketReportPDF(FPDF):
    def __init__(self):
        super().__init__(orientation='L', unit='mm', format='A4')
        self.WIDTH = 297
        self.HEIGHT = 210
    
    def header(self):
        self.set_fill_color(*MORANDI_COLORS['background'])
        self.rect(0, 0, self.WIDTH, 25, 'F')
        
        self.set_font('Helvetica', 'B', 16)
        self.set_text_color(*MORANDI_COLORS['text'])
        self.cell(0, 10, '俄罗斯电商吹风机市场分析简报', 0, 1, 'L', link= '')
        
        self.set_font('Helvetica', '', 9)
        self.set_text_color(*MORANDI_COLORS['text_light'])
        self.cell(0, 5, f'生成日期: {datetime.now().strftime("%Y-%m-%d %H:%M")}', 0, 1, 'R')
        
        self.ln(5)
    
    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(*MORANDI_COLORS['text_light'])
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')
    
    def section_title(self, title):
        self.set_font('Helvetica', 'B', 12)
        self.set_text_color(*MORANDI_COLORS['primary'])
        self.cell(0, 10, title, 0, 1, 'L')
        
        self.set_fill_color(*MORANDI_COLORS['accent'])
        self.rect(self.get_x(), self.get_y(), 30, 0.5, 'F')
        self.ln(3)
    
    def add_kpi_section(self, kpis):
        self.section_title('📈 核心KPI指标')
        
        start_x = 15
        gap = 65
        kpi_items = [
            ('总市场规模', kpis.get('total_market_size', 0), '₽'),
            ('平均客单价', kpis.get('avg_unit_price', 0), '₽'),
            ('最畅销品牌', kpis.get('top_brand', 'N/A'), ''),
            ('平均增长率', kpis.get('avg_growth', 0), '%')
        ]
        
        for i, (label, value, unit) in enumerate(kpi_items):
            x = start_x + i * gap
            
            self.set_xy(x, self.get_y())
            self.set_fill_color(*MORANDI_COLORS['background'])
            self.rect(x, self.get_y(), 60, 25, 'F')
            
            self.set_xy(x + 3, self.get_y() + 3)
            self.set_font('Helvetica', '', 7)
            self.set_text_color(*MORANDI_COLORS['text_light'])
            self.cell(54, 4, label.upper(), 0, 2)
            
            self.set_font('Helvetica', 'B', 14)
            self.set_text_color(*MORANDI_COLORS['primary'])
            
            if isinstance(value, (int, float)):
                if unit == '₽':
                    formatted = f"{unit}{value:,.0f}"
                elif unit == '%':
                    formatted = f"{value:+.1f}%"
                else:
                    formatted = str(value)
            else:
                formatted = str(value)[:15]
            
            self.cell(54, 8, formatted, 0, 2)
        
        self.ln(30)
    
    def add_brand_section(self, brand_df):
        if brand_df is None or brand_df.empty:
            return
        
        self.section_title('🏷️ 品牌市场占有率')
        
        top_brands = brand_df.head(5)
        
        self.set_font('Helvetica', 'B', 9)
        self.set_text_color(*MORANDI_COLORS['text'])
        
        col_widths = [60, 30, 35]
        headers = ['品牌', '商品数量', '市场份额']
        
        for i, header in enumerate(headers):
            self.cell(col_widths[i], 7, header, 1, 0, 'C')
        self.ln()
        
        self.set_font('Helvetica', '', 9)
        colors = [
            MORANDI_COLORS['primary'],
            MORANDI_COLORS['secondary'],
            MORANDI_COLORS['accent'],
            (168, 197, 168),
            (227, 201, 168)
        ]
        
        for idx, row in top_brands.iterrows():
            self.set_fill_color(*colors[top_brands.index.get_loc(idx) % len(colors)])
            self.cell(col_widths[0], 6, str(row.iloc[0])[:25], 1, 0, 'L', fill=True)
            self.cell(col_widths[1], 6, str(row.iloc[1]), 1, 0, 'C', fill=True)
            self.cell(col_widths[2], 6, f"{row.iloc[2] if len(row) > 2 else 0}%", 1, 1, 'C', fill=True)
        
        self.ln(5)
    
    def add_price_section(self, price_df):
        if price_df is None or price_df.empty:
            return
        
        self.section_title('💰 价格区间分布')
        
        self.set_font('Helvetica', 'B', 9)
        col_widths = [40, 30, 30]
        headers = ['价格区间', '商品数量', '占比']
        
        for i, header in enumerate(headers):
            self.cell(col_widths[i], 7, header, 1, 0, 'C')
        self.ln()
        
        self.set_font('Helvetica', '', 9)
        
        for idx, row in price_df.iterrows():
            if idx < 6:
                price_range = str(row.iloc[0])
                count = str(row.iloc[1])
                pct = f"{row.iloc[2]}%" if len(row) > 2 else "0%"
                
                self.cell(col_widths[0], 6, price_range, 1, 0, 'L')
                self.cell(col_widths[1], 6, count, 1, 0, 'C')
                self.cell(col_widths[2], 6, pct, 1, 1, 'C')
        
        self.ln(5)
    
    def add_concentration_section(self, concentration_data):
        if concentration_data is None:
            return
        
        self.section_title('📊 品牌集中度分析')
        
        self.set_font('Helvetica', '', 10)
        self.set_text_color(*MORANDI_COLORS['text'])
        
        cr3 = concentration_data.get('cr3', 0)
        cr5 = concentration_data.get('cr5', 0)
        
        self.cell(0, 8, f'CR3 (前3品牌市场份额): {cr3}%', 0, 1)
        self.cell(0, 8, f'CR5 (前5品牌市场份额): {cr5}%', 0, 1)
        
        if cr3 > 50:
            self.ln(3)
            self.set_text_color(150, 100, 100)
            self.cell(0, 8, '⚠️ 市场集中度较高，头部品牌占据主导地位', 0, 1)
        else:
            self.ln(3)
            self.set_text_color(100, 150, 100)
            self.cell(0, 8, '✅ 市场竞争相对分散', 0, 1)
        
        self.ln(5)
    
    def add_insight_section(self, insights):
        self.section_title('💡 市场洞察')
        
        self.set_font('Helvetica', '', 9)
        self.set_text_color(*MORANDI_COLORS['text'])
        
        for i, insight in enumerate(insights, 1):
            self.multi_cell(0, 6, f'{i}. {insight}')
            self.ln(2)
        
        self.ln(5)
    
    def add_footer_note(self):
        self.ln(10)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(*MORANDI_COLORS['text_light'])
        self.cell(0, 5, '本报告由 Streamlit 市场分析平台自动生成', 0, 1, 'C')


def generate_market_report(df, kpis, brand_df=None, price_df=None, concentration_data=None):
    pdf = MarketReportPDF()
    pdf.add_page()
    
    pdf.add_kpi_section(kpis)
    
    pdf.add_brand_section(brand_df)
    
    pdf.add_price_section(price_df)
    
    pdf.add_concentration_section(concentration_data)
    
    insights = generate_insights(df, kpis, concentration_data)
    pdf.add_insight_section(insights)
    
    pdf.add_footer_note()
    
    return pdf.output(dest='S').encode('latin-1')


def generate_insights(df, kpis, concentration_data):
    insights = []
    
    if concentration_data and concentration_data.get('cr3', 0) > 50:
        insights.append(f"市场CR3为{concentration_data['cr3']}%，头部品牌主导明显，新进入者需差异化竞争")
    
    price_col = None
    for col in ['价格(₽)', '价格', 'Price', 'price']:
        if col in df.columns:
            price_col = col
            break
    
    if price_col:
        avg_price = df[price_col].mean()
        if avg_price > 10000:
            insights.append(f"市场平均价格为{avg_price:,.0f}₽，高端产品占比较大")
        elif avg_price > 5000:
            insights.append(f"市场平均价格为{avg_price:,.0f}₽，中端市场为主")
        else:
            insights.append(f"市场平均价格为{avg_price:,.0f}₽，性价比产品主导")
    
    qty_col = None
    for col in ['月销量', '销量', 'Quantity']:
        if col in df.columns:
            qty_col = col
            break
    
    if qty_col:
        top_products = df.nlargest(3, qty_col)
        if len(top_products) > 0:
            product_names = []
            for col in ['商品名称', '产品名称', 'name']:
                if col in df.columns:
                    product_names = top_products[col].tolist()
                    break
            
            if product_names:
                insights.append(f"爆款商品: {'; '.join(str(n)[:20] for n in product_names[:3])}")
    
    if kpis.get('avg_growth', 0) > 10:
        insights.append(f"市场增长率强劲，月均增长{kpis['avg_growth']:.1f}%，处于快速发展期")
    elif kpis.get('avg_growth', 0) > 0:
        insights.append(f"市场稳步增长，月均增长{kpis['avg_growth']:.1f}%")
    else:
        insights.append("市场增长放缓，需关注竞品动态")
    
    if not insights:
        insights.append("数据已加载完成，请查看详细分析图表")
    
    return insights[:6]
