import React, { useState, useRef } from 'react';
import { Slider, Box, Typography, Button, Tooltip, IconButton, Select, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { Bubble } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import CachedIcon from '@mui/icons-material/Cached';
import InfoIcon from '@mui/icons-material/Info';
import { useFileContext } from './FileContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, ChartTooltip, Legend, zoomPlugin);

const getColorForValue = (value: number): string => {
  const colors = ['#67000d', '#a50f15', '#cb181d', '#ef3b2c', '#fb6a4a', '#fc9272', '#fcbba1', '#fee0d2', '#fff5f0'];
  const index = Math.min(Math.floor(value * colors.length), colors.length - 1);
  return colors[index];
};

const generateRandomConformanceDistribution = () => {
  return [
    { range: [0, 0.1], count: Math.floor(Math.random() * 151) + 50, finalizedPercentage: Math.floor(Math.random() * 71) + 20 },
    { range: [0.1, 0.2], count: Math.floor(Math.random() * 151) + 50, finalizedPercentage: Math.floor(Math.random() * 71) + 20 },
    { range: [0.2, 0.3], count: Math.floor(Math.random() * 151) + 50, finalizedPercentage: Math.floor(Math.random() * 71) + 20 },
    { range: [0.3, 0.4], count: Math.floor(Math.random() * 151) + 50, finalizedPercentage: Math.floor(Math.random() * 71) + 20 },
    { range: [0.4, 0.5], count: Math.floor(Math.random() * 151) + 50, finalizedPercentage: Math.floor(Math.random() * 71) + 20 },
    { range: [0.5, 0.6], count: Math.floor(Math.random() * 151) + 50, finalizedPercentage: Math.floor(Math.random() * 71) + 20 },
    { range: [0.6, 0.7], count: Math.floor(Math.random() * 151) + 50, finalizedPercentage: Math.floor(Math.random() * 71) + 20 },
    { range: [0.7, 0.8], count: Math.floor(Math.random() * 151) + 50, finalizedPercentage: Math.floor(Math.random() * 71) + 20 },
    { range: [0.8, 0.9], count: Math.floor(Math.random() * 151) + 50, finalizedPercentage: Math.floor(Math.random() * 71) + 20 },
    { range: [0.9, 1], count: Math.floor(Math.random() * 151) + 50, finalizedPercentage: Math.floor(Math.random() * 71) + 20 }
  ];
};

const ConformanceOutcomeChart: React.FC = () => {
  const [conformance, setConformance] = useState<number>(0);
  const [selectedActivity, setSelectedActivity] = useState<string | null>('Payment Handled');
  const chartRef = useRef<any>(null);
  const navigate = useNavigate();
  const { extractedElements } = useFileContext();

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    setConformance(newValue as number);
  };

  const handleReset = () => {
    setConformance(0);
    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  const handleActivityChange = (event: any) => {
    setSelectedActivity(event.target.value);
  };
  

  const { outcomeBins, desiredOutcomes, matching_mode } = useFileContext();
  const prepareChartData = () => {
    const filteredBins = outcomeBins.filter(
      (bin) => bin.range[0] >= conformance || bin.range[1] > conformance
    );
    const maxCount = Math.max(...outcomeBins.map(bin => bin.traceCount || 1)); 
    const conformanceRanges = filteredBins.map((bin) => {
      const midpoint = (bin.range[0] + bin.range[1]) / 2;
      return {
        x: midpoint,
        y: bin.percentageEndingCorrectly,
        r: (bin.traceCount / maxCount) * 30 + 5, 
        count: bin.traceCount,
      };
    });
  
    return {
      datasets: [
        {
          label: '',
          data: conformanceRanges,
          backgroundColor: conformanceRanges.map((range) => getColorForValue(range.x)),
          borderColor: '#000000',
          borderWidth: 1,
        },
      ],
    };
  };
  



  const options = {
    scales: {
      x: {
        title: {
          display: true,
          text: 'Conformance',
        },
      },
      y: {
        title: {
          display: true,
          text: `${matching_mode === 'contains' 
            ? 'Percentage of Traces Containing' 
            : 'Percentage of Traces Ending with'} ${desiredOutcomes[0] || 'desired outcome'}`,
        },
        suggestedMin: 0,
        suggestedMax: 100,
      }
      
    },
    
    plugins: {
      zoom: {
        pan: { enabled: true, mode: 'xy' as const },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'xy' as const },
      },
      legend: {
        display: false, // Prevents unwanted legend box
      },
      tooltip: {
        callbacks: {
          label: function (tooltipItem: any) {
            const dataItem = tooltipItem.raw;
            return `${matching_mode === 'contains' 
            ? `Conformance: ${dataItem.x.toFixed(2)}, ${dataItem.y.toFixed(2)}% containing ` 
            : `Conformance: ${dataItem.x.toFixed(2)}, ${dataItem.y.toFixed(2)}% ended with ` } ${desiredOutcomes[0] || 'desired outcome'}, ${Math.round(dataItem.count)} traces`;
          },
        },
      },
      
    },
    maintainAspectRatio: false,
  };
  

  const chartData = prepareChartData();


  return (
    <Box sx={{ width: '90vw', maxWidth: 1000, height: 600, margin: '0 auto', position: 'relative', overflow: 'visible' }}>
      <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
        <Typography variant="h5" gutterBottom align="center">
          Bubble Chart: Conformance vs Process Outcome
        </Typography>
        <Tooltip title="This view shows the relationship between conformance and the desired process outcome. The desired outcome is derived from the BPMN model. Each bubble represents a conformance category, with its size indicating the number of traces within that category." arrow>
          <IconButton>
            <InfoIcon color="primary" />
          </IconButton>
        </Tooltip>
      </Box>

      <Typography variant="h6" gutterBottom>
        Conformance Threshold
      </Typography>
      <Slider
        value={conformance}
        min={0}
        max={1}
        step={0.01}
        onChange={handleSliderChange}
        valueLabelDisplay="auto"
        sx={{ color: getColorForValue(conformance), '& .MuiSlider-thumb': { backgroundColor: '#000' } }}
      />
            <Typography variant="body1" gutterBottom>
              Current Conformance: {conformance.toFixed(2)}
            </Typography>
      <Button variant="contained" color="primary" onClick={handleReset} sx={{ marginBottom: 2 }}>
        Reset
      </Button>

      <Box sx={{ height: 400, marginTop: 2 }}>
        <Bubble ref={chartRef} data={chartData} options={options} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <Button
          variant="contained"
          color="primary"
          sx={{
            fontSize: '1.5rem',
            minWidth: '50px',
            height: '50px',
            fontWeight: 'bold',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={() => navigate('/violation-guidelines')}
        >
          ←
        </Button>

        <Button
  variant="contained"
  color="primary"
  sx={{
    fontSize: '1.5rem',
    minWidth: '50px',
    height: '50px',
    fontWeight: 'bold',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '8px', // Rectangular with rounded edges (similar to the other button)
  }}
  onClick={() => navigate('/')} // Navigate to the starting page
>
  <CachedIcon sx={{ fontSize: '1.5rem' }} /> {/* Use the CachedIcon */}
</Button>
 
      </Box>
    </Box>
  );
};

export default ConformanceOutcomeChart;




























































