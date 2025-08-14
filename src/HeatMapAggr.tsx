import React, { useState, useRef } from 'react';
import { Slider, Box, Typography, TextField, Button, Tooltip, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip as ChartTooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import InfoIcon from '@mui/icons-material/Info';
import { useFileContext } from './FileContext';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';





// Register necessary components for Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend, zoomPlugin);

interface Bin {
  traces: { trace: string; conformance: number }[];
  averageConformance: number;
  traceCount: number;
}

const getColorForConformance = (conformance: number): string => {
  const colors = ['#67000d', '#a50f15', '#cb181d', '#ef3b2c', '#fb6a4a', '#fc9272', '#fcbba1', '#fee0d2', '#fff5f0'];
  const index = Math.min(Math.floor(conformance * colors.length), colors.length - 1);
  return colors[index];
};

const aggregateTraces = (traces: { trace: string; conformance: number }[], numBins: number = 10): Bin[] => {
  const binSize = 1 / numBins;
  const bins: Bin[] = Array(numBins)
    .fill(null)
    .map(() => ({
      traces: [] as { trace: string; conformance: number }[],
      averageConformance: 0,
      traceCount: 0,
    }));

  traces.forEach(({ trace, conformance }) => {
    const binIndex = Math.min(Math.floor(conformance / binSize), numBins - 1);
    bins[binIndex].traces.push({ trace, conformance });
    bins[binIndex].averageConformance += conformance;
    bins[binIndex].traceCount += 1;
  });

  bins.forEach((bin) => {
    if (bin.traceCount > 0) {
      bin.averageConformance /= bin.traceCount;
    }
  });

  return bins;
};



const HeatMapAggr: React.FC = () => {
  const { fitnessData, conformanceBins, uniqueSequences, traceSequences } = useFileContext();
  const [conformance, setConformance] = useState<number>(0);
  const [selectedTraces, setSelectedTraces] = useState<number[]>([]);
  const [traceInput, setTraceInput] = useState<string>('');
  const chartRef = useRef<any>(null);
  const chartLabelsRef = useRef<string[]>([]);
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState(false);
  const [selectedBinSequences, setSelectedBinSequences] = useState<string[][]>([]);
  const [selectedBinLabel, setSelectedBinLabel] = useState<string>('');


  const traces = fitnessData.map((item) => item.trace);
  const conformanceValues = fitnessData.map((item) => item.conformance);
  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    setConformance(newValue as number);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setTraceInput(value);
    const traceNumbers = value
      .split(',')
      .map((num) => parseInt(num.trim()))
      .filter((num) => !isNaN(num));
    setSelectedTraces(traceNumbers);

    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };

  const handleResetSelection = () => {
    setSelectedTraces([]);
    setConformance(0);
    setTraceInput('');

    if (chartRef.current) {
      chartRef.current.resetZoom();
    }
  };
const handleBarClick = (event: any) => {
  if (!chartRef.current) return;

  const chart = chartRef.current;
  const elements = chart.getElementsAtEventForMode(event.nativeEvent, 'nearest', { intersect: true }, true);

  if (elements.length > 0) {
    const index = elements[0].index;

    // If we're showing selected traces
  if (selectedTraces.length > 0) {
  const traceNum = selectedTraces[index]; // 1-based trace number
  const traceId = `Trace ${traceNum}`;
  const traceSequenceObj = traceSequences.find(seq => seq.trace === traceId);
  const traceFitness = fitnessData.find(f => f.trace === traceId);

  if (!traceSequenceObj || !traceFitness) return;

  const binIndex = Math.min(Math.floor(traceFitness.conformance * 10), 9);
  const bin = uniqueSequences?.[binIndex];

 setSelectedBinSequences([traceSequenceObj.sequence]);

  setSelectedBinLabel(`${traceId} (Bin ${binIndex / 10}–${(binIndex + 1) / 10})`);
}
 else {
      // Bin view (default)
      const bin = uniqueSequences?.[index];
      if (!bin) return;
      setSelectedBinSequences(bin.sequences);
      setSelectedBinLabel(chartLabelsRef.current[index]);
    }

    setOpenModal(true);
  }
};



  const filteredData = traces
    .map((trace, index) => ({ trace, conformance: conformanceValues[index] }))
    .filter((item) => item.conformance >= conformance);

  let data;
  let chartOptions;

  if (selectedTraces.length > 0) {
    const selectedData = selectedTraces
      .map((traceNum) => ({
        trace: `Trace ${traceNum}`,
        conformance: conformanceValues[traceNum - 1],
      }))
      .filter((item) => item.conformance >= conformance);

      chartLabelsRef.current = selectedData.map((item) => item.trace);


    data = {
      labels: selectedData.map((item) => item.trace),
      datasets: [
        {
          label: 'Conformance',
          data: selectedData.map((item) => item.conformance),
          backgroundColor: selectedData.map((item) => getColorForConformance(item.conformance)),
          borderColor: '#000',
          borderWidth: 1,
        },
      ],
    };

    chartOptions = {
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Traces',
          },
        },
        y: {
          beginAtZero: true,
          max: 1,
          title: {
            display: true,
            text: 'Conformance',
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (tooltipItem: any) {
              const traceLabel = tooltipItem.label;
              const conformanceValue = tooltipItem.raw;
              return `Trace: ${traceLabel}, Conformance: ${conformanceValue.toFixed(4)}`;
            },
          },
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x' as const,
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: 'x' as const,
          },
        },
        legend: {
          display: false,
        },
      },
      maintainAspectRatio: false,
    };
  } else {
    const aggregatedBins = conformanceBins
    .filter((bin) => bin.averageConformance >= conformance)
    .map((bin) => ({
      traces: [],
      averageConformance: bin.averageConformance,
      traceCount: bin.traceCount,
    }));
  
    
    chartLabelsRef.current = aggregatedBins.map((_, index) => ((index + 1) / aggregatedBins.length).toFixed(1));

    data = {
      labels: aggregatedBins.map((_, index) => ((index + 1) / aggregatedBins.length).toFixed(1)),
      datasets: [
        {
          label: 'Traces',
          data: aggregatedBins.map((bin) => bin.traceCount),
          backgroundColor: aggregatedBins.map((bin) => getColorForConformance(bin.averageConformance)),
          borderColor: '#000',
          borderWidth: 1,
        },
      ],
    };

    chartOptions = {
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Conformance',
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Traces',
          },
        },
      },
      plugins: {
       tooltip: {
  callbacks: {
 label: function (tooltipItem: any) {
  const binIndex = tooltipItem.dataIndex;
  const binLabel = tooltipItem.label;
  const traceCount = tooltipItem.raw;
  const uniqueCount = uniqueSequences?.[binIndex]?.uniqueSequences ?? 'N/A';
  return [
    `Bin Avg Conformance: ${binLabel}`,
    `Traces: ${traceCount}`,
    `Unique Sequences: ${uniqueCount}`,
    `💡 Click to view sequences`,
  ];
}
  },
},

        zoom: {
          pan: {
            enabled: true,
            mode: 'x' as const,
          },
          zoom: {
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: 'x' as const,
          },
        },
        legend: {
          display: false,
        },
      },
      maintainAspectRatio: false,
    };
  }

  return (
    <Box sx={{ width: 800, height: 900, margin: '0 auto', position: 'relative' }}>
      <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
        <Typography variant="h5" gutterBottom align="center">
          Conformance Distribution
        </Typography>
        <Tooltip title="This view shows the distribution of trace conformance. Traces are grouped into 10 conformance bins based on their conformance values. Users can also filter and view specific traces by entering their trace numbers in the search bar" arrow>
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
        sx={{
          color: getColorForConformance(conformance),
          '& .MuiSlider-thumb': {
            backgroundColor: '#000',
          },
        }}
      />
      <Typography variant="body1" gutterBottom>
        Current Conformance: {conformance.toFixed(2)}
      </Typography>
      <Button variant="contained" color="primary" onClick={handleResetSelection} sx={{ marginBottom: 2 }}>
        Reset
      </Button>

      <Typography variant="h6" gutterBottom>
        Enter Trace Numbers to Compare (comma-separated)
      </Typography>
      <TextField
        fullWidth
        variant="outlined"
        value={traceInput}
        onChange={handleInputChange}
        placeholder="e.g. 15, 19, 45"
        sx={{ marginBottom: 2 }}
      />
      <Typography variant="body2" color="textSecondary" sx={{ marginBottom: 1 }}>
  💡 Tip: Click on a bar to see its activity sequences.
</Typography>


      <Box sx={{ height: 500 }}>
        <Bar ref={chartRef} data={data} options={chartOptions} onClick={handleBarClick} />

      </Box>

      <Button
        variant="contained"
        color="primary"
        sx={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          fontSize: '1.5rem',
          minWidth: '50px',
          height: '50px',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onClick={() => navigate('/activity-stats')}
      >
        ←
      </Button>
      <Button
        variant="contained"
        color="primary"
        sx={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
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
        →
      </Button>
      <Dialog open={openModal} onClose={() => setOpenModal(false)} maxWidth="md" fullWidth>
  <DialogTitle>Activity Sequences for {selectedBinLabel}</DialogTitle>

  <DialogContent dividers>
    {selectedBinSequences.length > 0 ? (
      <ul>
        {selectedBinSequences.map((seq, idx) => (
          <li key={idx}>{seq.join(' → ')}</li>
        ))}
      </ul>
    ) : (
      <Typography>No sequences available.</Typography>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setOpenModal(false)} color="primary">
      Close
    </Button>
  </DialogActions>
</Dialog>

    </Box>
  );
};

export default HeatMapAggr;





























