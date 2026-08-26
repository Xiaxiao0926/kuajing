export const chartColors = {
  primary: '#8B9DC3',
  secondary: '#B8A9C9',
  accent: '#D4B8A0',
  success: '#A8C5A8',
  warning: '#E3C9A8',
  palette: [
    '#8B9DC3',
    '#B8A9C9',
    '#D4B8A0',
    '#A8C5A8',
    '#E3C9A8',
    '#C9B8D4',
    '#C5D4C9',
    '#D4C9B8',
  ]
};

export const pieChartOptions = {
  colors: chartColors.palette,
  tooltip: {
    trigger: 'item',
    formatter: '{b}: {c} ({d}%)'
  },
  legend: {
    orient: 'horizontal',
    bottom: 0,
    textStyle: {
      color: '#7A7A7A'
    }
  }
};

export const barChartOptions = {
  colors: [chartColors.primary, chartColors.secondary],
  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'shadow'
    }
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  }
};

export const lineChartOptions = {
  tooltip: {
    trigger: 'axis'
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  },
  xAxis: {
    axisLine: {
      lineStyle: { color: '#E8E8E8' }
    },
    axisLabel: {
      color: '#7A7A7A'
    }
  },
  yAxis: {
    axisLine: {
      lineStyle: { color: '#E8E8E8' }
    },
    axisLabel: {
      color: '#7A7A7A'
    },
    splitLine: {
      lineStyle: { color: '#F0F0F0' }
    }
  }
};

export function formatNumber(num) {
  if (num === null || num === undefined) return '-';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export function formatCurrency(num) {
  if (num === null || num === undefined) return '-';
  return '₽ ' + formatNumber(num);
}

export function formatCurrencyDual(num) {
  if (num === null || num === undefined) return { rub: '-', cny: '-' };
  const rmb = Math.round(num * R);
  return {
    rub: '₽ ' + formatNumber(num),
    cny: '¥ ' + formatNumber(rmb)
  };
}
import { R } from './ozonEngine'
