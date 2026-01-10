import React from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const ShapChart = ({ explanation }) => {
  if (!explanation) return null;

  const data = {
    labels: explanation.map(e => e.feature),
    datasets: [{
      label: 'Impact on Fraud Probability',
      data: explanation.map(e => e.impact),
      backgroundColor: explanation.map(e => e.impact > 0 ? '#ff0055' : '#00ff88'),
      borderColor: '#fff',
      borderWidth: 1
    }]
  };

  const options = {
    indexAxis: 'y', // Horizontal Bar Chart
    responsive: true,
    plugins: {
        legend: { display: false },
        title: { display: true, text: 'AI Logic (SHAP Values)', color: '#fff' }
    },
    scales: {
        x: { ticks: { color: '#888' }, grid: { color: '#333' } },
        y: { ticks: { color: '#fff' }, grid: { display: false } }
    }
  };

  return <Bar data={data} options={options} />;
};

export default ShapChart;