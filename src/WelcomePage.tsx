import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Stack, TextField, Paper, CircularProgress,
  Checkbox, FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  ListItemText, IconButton, Tooltip
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useFileContext } from './FileContext';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { UniqueSequenceBin } from './FileContext';
import InfoIcon from "@mui/icons-material/Info";

const WelcomePage: React.FC = () => {
  const [bpmnFile, setBpmnFile] = useState<File | null>(null);
  const [xesFile, setXesFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [matchingMode, setMatchingMode] = useState<'end' | 'contains'>('end');
  const [manualMode, setManualMode] = useState(false);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [availableActivities, setAvailableActivities] = useState<string[]>([]);

  const navigate = useNavigate();
  const {
    setBpmnFileContent,
    setXesFileContent,
    setFitnessData,
    setConformanceBins,
    setActivityDeviations,
    setOutcomeBins,
    setDesiredOutcomes,
      setmatching_mode,
    setAttributeConformance,
    setUniqueSequences,
    setAmountConformanceData,
    setTraceSequences
  } = useFileContext();

  const API_BASE = "https://ccviz-backend.onrender.com";

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    setFile: React.Dispatch<React.SetStateAction<File | null>>,
    setFileContent: (content: string | null) => void
  ) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const file = target.files[0];
      setFile(file);

      const reader = new FileReader();
      reader.onload = async () => {
        const content = reader.result as string;
        setFileContent(content);

        // Fetch available activities right after BPMN upload
        if (file.name.endsWith('.bpmn')) {
          const formData = new FormData();
          formData.append('bpmn', file);
          const resp = await fetch(`${API_BASE}/api/bpmn-activities`, {
            method: 'POST',
            body: formData,
          });
          const data = await resp.json();
          setAvailableActivities(data.activities);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleNavigateToViewBPMN = () => {
    navigate('/view-bpmn');
  };

  const handleWakeUp = async () => {
    const timeout = 60000; // 60 seconds
    const start = Date.now();

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);

      await fetch(`${API_BASE}/ping`, { signal: controller.signal });
      clearTimeout(id);

      const elapsed = Date.now() - start;
      if (elapsed <= timeout) {
        window.alert("Backend active");
      } else {
        window.alert("Backend took longer than 1 minute to awake");
      }
    } catch (error) {
      window.alert("Backend took longer than 1 minute to awake");
    }
  };

  const handleUploadOrNavigate = async () => {
    const startTime = performance.now(); // start timing

    if (uploadComplete) {
      handleNavigateToViewBPMN();
      return;
    }
    if (!bpmnFile || !xesFile) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append('bpmn', bpmnFile);
    formData.append('xes', xesFile);

    try {
      const uploadResponse = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadResponse.json();
      console.log('Upload Response:', uploadData);


      const sequenceResponse = await fetch(`${API_BASE}/api/unique-sequences`);
      const sequenceJson: UniqueSequenceBin[] = await sequenceResponse.json();
      setUniqueSequences(sequenceJson);

      const traceSeqResponse = await fetch(`${API_BASE}/api/trace-sequences`);
      const traceSeqJson = await traceSeqResponse.json();
      setTraceSequences(traceSeqJson);

      const fitnessResponse = await fetch(`${API_BASE}/api/fitness`);
      const fitnessJson = await fitnessResponse.json();
      setFitnessData(fitnessJson);

      const binResponse = await fetch(`${API_BASE}/api/conformance-bins`);
      const binJson = await binResponse.json();
      setConformanceBins(binJson);

      const deviationResponse = await fetch(`${API_BASE}/api/activity-deviations`);
      const deviationJson = await deviationResponse.json();
      setActivityDeviations({
        deviations: deviationJson.deviations,
        total_traces: deviationJson.total_traces,
      });

      // BEFORE fetch: ensure selectedActivities is an array with 0 or 1 element (single-choice)
      const payload = {
        matchingMode,
        selectedActivities: manualMode ? selectedActivities : []
      };
      console.log("Sending outcome payload:", payload);

      const outcomeResponse = await fetch(`${API_BASE}/api/outcome-distribution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const outcomeJson = await outcomeResponse.json();
      console.log("Outcome response:", outcomeJson);

      // Guard when server returns error
      if (!outcomeResponse.ok) {
        console.error('Server error retrieving outcome distribution', outcomeJson);
      } else {
        setOutcomeBins(outcomeJson.bins || []);
        setDesiredOutcomes(outcomeJson.desiredOutcomes || []);
        setmatching_mode(outcomeJson.matching_mode || '');
      }

      const attributeResponse = await fetch(`${API_BASE}/api/conformance-by-event_attribute`);
      const attributeJson = await attributeResponse.json();
      setAttributeConformance(attributeJson);

      setUploadComplete(true);
    } catch (error) {
      console.error('Error uploading files or fetching data:', error);
    } finally {
      setIsUploading(false);

      // Measure elapsed time
      const endTime = performance.now();
      const elapsedMs = endTime - startTime;
      console.log(`handleUploadOrNavigate took ${elapsedMs.toFixed(2)} ms`);


    }
  };

  const handlePreloadDataset = async () => {
    try {
      const bpmnResponse = await fetch(`${API_BASE}/preload/Model_A_corrected.bpmn`);
      const xesResponse = await fetch(`${API_BASE}/preload/BPIC12_Log_onlyA.csv`);
      if (!bpmnResponse.ok || !xesResponse.ok) throw new Error('Failed to fetch default files');

      const bpmnText = await bpmnResponse.text();
      const xesText = await xesResponse.text();

      const bpmnBlob = new Blob([bpmnText], { type: 'text/xml' });
      const xesBlob = new Blob([xesText], { type: 'text/xml' });

      const bpmnFile = new File([bpmnBlob], 'Model_A_corrected.bpmn', { type: 'text/xml' });
      const xesFile = new File([xesBlob], 'BPIC12_Log_onlyA.csv', { type: 'text/xml' });

      setBpmnFile(bpmnFile);
      setXesFile(xesFile);
      setBpmnFileContent(bpmnText);
      setXesFileContent(xesText);

      handleUploadOrNavigate();
    } catch (error) {
      console.error('Error preloading dataset:', error);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 700, margin: '0 auto', textAlign: 'center', padding: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
        Welcome to the Conformance Visualization App
      </Typography>
      <Typography variant="body1" gutterBottom sx={{ marginBottom: 3 }}>
        Upload your BPMN and XES files to start analyzing process conformance.
      </Typography>
       <button onClick={handleWakeUp} style={{ padding: "10px 20px", marginTop: "10px" }}>
        Wake Backend
      </button>

      <Stack spacing={3}>
        {/* BPMN upload */}
        <Paper sx={{ padding: 3, borderRadius: 2, boxShadow: 3, textAlign: 'left' }}>
          <Typography variant="h6" gutterBottom>
            <UploadFileIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Upload BPMN File
          </Typography>
          <TextField
            type="file"
            inputProps={{ accept: '.bpmn' }}
            onChange={(event) => handleFileChange(event, setBpmnFile, setBpmnFileContent)}
            fullWidth
            variant="outlined"
            helperText={
              bpmnFile ? `Selected File: ${bpmnFile.name}` : 'Please upload a valid `.bpmn` file'
            }
          />
        </Paper>

        {/* XES upload */}
        <Paper sx={{ padding: 3, borderRadius: 2, boxShadow: 3, textAlign: 'left' }}>
          <Typography variant="h6" gutterBottom>
            <UploadFileIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Upload Event Log File
          </Typography>
          <TextField
            type="file"
            inputProps={{ accept: '.xes,.csv' }}
            onChange={(event) => handleFileChange(event, setXesFile, setXesFileContent)}
            fullWidth
            variant="outlined"
            helperText={
              xesFile ? `Selected File: ${xesFile.name}` : 'Please upload a valid `.xes` or `.csv` file'
            }
          />
        </Paper>

        {/* Outcome selection */}

        <Paper sx={{ padding: 3, borderRadius: 2, boxShadow: 3, textAlign: 'left' }}>

          <Typography variant="h6" gutterBottom>Define Desired Process Outcome (binary feature)
          <Tooltip title="To define what process outcome can be considered positive, you currently have two options:
          (1) a trace can be considered to have a positive outcome if it ends with a certain activity
          (2) a trace can be considered to have a positive outcome if it contains a certain activity" arrow>
            <IconButton>
              <InfoIcon color="primary" />
            </IconButton>
          </Tooltip>
          </Typography>



          <FormControlLabel
            control={
              <Checkbox checked={manualMode} onChange={(e) => setManualMode(e.target.checked)} />
            }
            label="Define outcome manually"
          />
          {manualMode && (
            <TextField
              select
              label="Matching Mode"
              value={matchingMode}
              onChange={(e) => setMatchingMode(e.target.value as 'end' | 'contains')}
              SelectProps={{ native: true }}
              fullWidth
              sx={{ mb: 2 }}
            >
              <option value="end">Ends With</option>
              <option value="contains">Contains</option>
            </TextField>
          )}

          {manualMode && (


            <FormControl fullWidth>
              <InputLabel id="activity-select-label">Select Activity</InputLabel>
              <Select
                labelId="activity-select-label"
                value={selectedActivities[0] || ''} // Single value
                onChange={(e) => setSelectedActivities([e.target.value])} // Store as array for consistency
                disabled={availableActivities.length === 0} // Disable if no BPMN uploaded
              >
                {availableActivities.map((activity) => (
                  <MenuItem key={activity} value={activity}>
                    {activity}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Paper>

        {/* Upload button */}
        <Button
          variant="contained"
          color="primary"
          onClick={handleUploadOrNavigate}
          disabled={!bpmnFile || !xesFile || isUploading}
          startIcon={
            isUploading ? <CircularProgress size={20} color="inherit" />
            : uploadComplete ? <VisibilityIcon />
            : <UploadFileIcon />
          }
          sx={{
            padding: '12px 24px',
            fontSize: '1rem',
            fontWeight: 'bold',
            width: '100%',
            maxWidth: 300,
            backgroundColor: !bpmnFile || !xesFile ? 'grey.400' : undefined,
            '&:hover': { backgroundColor: !bpmnFile || !xesFile ? 'grey.400' : undefined },
            alignSelf: 'center',
            mt: 2,
          }}
        >
          {isUploading ? 'Processing...' : uploadComplete ? 'View BPMN' : 'Upload & Process'}
        </Button>

        {/* Preload button */}
        <Button
          variant="outlined"
          color="secondary"
          onClick={handlePreloadDataset}
          sx={{ fontWeight: 'bold', padding: '12px 24px', maxWidth: 300, alignSelf: 'center' }}
        >
          Preload Dataset
        </Button>
      </Stack>
    </Box>
  );
};

export default WelcomePage;
