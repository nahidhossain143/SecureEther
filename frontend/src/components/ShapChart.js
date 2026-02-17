import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ShapChart = ({ explanation }) => {
  if (!explanation || explanation.length === 0) return null;

  const truncate = (str, n = 26) => str.length > n ? str.slice(0, n) + '…' : str;

  const labels  = explanation.map(e => truncate(e.feature));
  const impacts = explanation.map(e => e.impact);

  const backgroundColors = impacts.map(v =>
    v > 0 ? 'rgba(255,0,85,0.7)' : 'rgba(0,255,136,0.7)'
  );
  const borderColors = impacts.map(v => v > 0 ? '#ff0055' : '#00ff88');

  const data = {
    labels,
    datasets: [{
      label: 'SHAP Impact',
      data: impacts,
      backgroundColor: backgroundColors,
      borderColor: borderColors,
      borderWidth: 1.5,
      borderRadius: 2,
    }]
  };

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: 'SHAP FEATURE IMPACT',
        color: '#444',
        font: { family: 'Orbitron', size: 9, weight: '400' },
        padding: { bottom: 8 }
      },
      tooltip: {
        backgroundColor: '#0a0a0a',
        borderColor: '#222',
        borderWidth: 1,
        callbacks: {
          title:  (items) => explanation[items[0].dataIndex].feature,
          label:  (ctx) => {
            const item = explanation[ctx.dataIndex];
            const dir  = item.direction || (item.impact > 0 ? 'increases fraud risk' : 'decreases fraud risk');
            return [
              ` Impact : ${item.impact.toFixed(4)}`,
              ` Value  : ${item.value != null ? item.value.toFixed(4) : 'N/A'}`,
              ` Effect : ${dir}`,
            ];
          }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#444', font: { size: 9 } },
        grid:  { color: '#111' },
        border: { color: '#333' },
      },
      y: {
        ticks: { color: '#aaa', font: { size: 9 } },
        grid:  { display: false },
      }
    }
  };

  const height = Math.max(180, explanation.length * 36);

  return (
    <div className="w-full" style={{ height }}>
      <Bar data={data} options={options} />
    </div>
  );
};

export default ShapChart;