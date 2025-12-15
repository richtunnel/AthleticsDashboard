"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  TextField,
  Autocomplete,
  Box,
  Typography,
  CircularProgress,
  Chip,
} from "@mui/material";
import { School as SchoolIcon, LocationOn as LocationIcon } from "@mui/icons-material";
import { useDebounce } from "@/hooks/useDebounce";

type PlacePrediction = {
  placeId: string;
  description: string;
  structuredFormatting: {
    mainText: string;
    secondaryText: string;
  };
};

type PlaceDetails = {
  formattedAddress: string;
  addressComponents: any[];
  types: string[];
  isSchool: boolean;
  geometry: any;
};

type Props = {
  value: string;
  onChange: (value: string, placeDetails?: PlaceDetails) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  size?: "small" | "medium";
  error?: boolean;
  helperText?: string;
};

/**
 * SchoolAddressAutocomplete Component
 * 
 * Provides Google Places autocomplete for school addresses with:
 * - Server-side API calls (secure)
 * - School detection (shows school icon badge)
 * - Debounced search
 * - Session token for billing optimization
 */
export default function SchoolAddressAutocomplete({
  value,
  onChange,
  label = "School Address",
  placeholder = "e.g., 123 Main St, City, State 12345",
  required = false,
  disabled = false,
  size = "small",
  error = false,
  helperText,
}: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [options, setOptions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSchool, setIsSchool] = useState(false);
  const sessionTokenRef = useRef<string>(generateSessionToken());

  // Generate a unique session token for billing optimization
  function generateSessionToken(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  // Fetch autocomplete predictions
  const fetchPredictions = async (searchText: string) => {
    if (!searchText || searchText.trim().length < 3) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/google-places/autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: searchText,
          sessionToken: sessionTokenRef.current,
        }),
      });

      // Gracefully handle non-OK responses (500, 401, etc.)
      if (!response.ok) {
        console.warn(`Google Places API returned ${response.status}, using manual entry mode`);
        setOptions([]);
        return;
      }

      const data = await response.json();

      if (data.success && data.predictions) {
        setOptions(data.predictions);
      } else {
        // Silently fail and allow manual entry - don't confuse users with errors
        console.warn("Google Places API unavailable, using manual entry mode:", data.error);
        setOptions([]);
      }
    } catch (error) {
      // Silently fail and allow manual entry - API issues should not block user
      console.warn("Google Places API connection failed, using manual entry mode:", error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search function using custom hook
  const debouncedFetch = useDebounce(fetchPredictions, 300);

  // Handle input change
  const handleInputChange = (event: any, newInputValue: string) => {
    setInputValue(newInputValue);
    debouncedFetch(newInputValue);
  };

  // Fetch place details when user selects an option
  const fetchPlaceDetails = async (placeId: string) => {
    try {
      const response = await fetch("/api/google-places/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId,
          sessionToken: sessionTokenRef.current,
        }),
      });

      // Gracefully handle non-OK responses (500, 401, etc.)
      if (!response.ok) {
        console.warn(`Google Places API returned ${response.status}, using manual entry mode`);
        return null;
      }

      const data = await response.json();

      if (data.success && data.result) {
        const placeDetails: PlaceDetails = data.result;
        setIsSchool(placeDetails.isSchool);
        
        // Generate new session token after completing a session
        sessionTokenRef.current = generateSessionToken();
        
        return placeDetails;
      } else {
        // Silently fail and allow manual entry
        console.warn("Google Places API unavailable for details, using description:", data.error);
        return null;
      }
    } catch (error) {
      // Silently fail and allow manual entry
      console.warn("Google Places API connection failed for details:", error);
      return null;
    }
  };

  // Handle selection
  const handleChange = async (event: any, newValue: PlacePrediction | string | null) => {
    if (typeof newValue === "string") {
      // User typed and pressed enter (freeSolo mode)
      onChange(newValue);
      setInputValue(newValue);
      setIsSchool(false);
    } else if (newValue && newValue.placeId) {
      // User selected an autocomplete option
      const placeDetails = await fetchPlaceDetails(newValue.placeId);
      
      if (placeDetails) {
        onChange(placeDetails.formattedAddress, placeDetails);
        setInputValue(placeDetails.formattedAddress);
      } else {
        // Fallback to description if details fetch fails
        onChange(newValue.description);
        setInputValue(newValue.description);
        setIsSchool(false);
      }
    } else {
      // Cleared
      onChange("");
      setInputValue("");
      setIsSchool(false);
    }
  };

  // Handle blur - save manually entered text if user didn't select from dropdown
  const handleBlur = () => {
    if (inputValue && inputValue.trim() !== value) {
      // User has typed something that differs from the current value
      // and hasn't selected from dropdown - save the manual entry
      onChange(inputValue.trim());
    }
  };

  // Sync internal input value with external value prop
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Box sx={{ position: "relative" }}>
      <Autocomplete
        freeSolo={true} // Allow manual text entry if API fails
        options={options}
        getOptionLabel={(option) => {
          if (typeof option === "string") return option;
          return option.description;
        }}
        filterOptions={(x) => x} // Disable built-in filtering (we use API)
        value={null} // Controlled by inputValue
        inputValue={inputValue}
        onInputChange={handleInputChange}
        onChange={handleChange}
        loading={loading}
        disabled={disabled}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            required={required}
            size={size}
            error={error}
            helperText={helperText || "Start typing or enter address manually"}
            onBlur={handleBlur}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LocationIcon sx={{ color: "text.secondary", fontSize: 20 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {option.structuredFormatting.mainText}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {option.structuredFormatting.secondaryText}
              </Typography>
            </Box>
          </Box>
        )}
        noOptionsText={
          inputValue.length < 3
            ? "Type at least 3 characters to search or enter manually"
            : "No addresses found - you can enter manually"
        }
      />
      
      {/* School badge */}
      {isSchool && inputValue && (
        <Chip
          icon={<SchoolIcon />}
          label="School Detected"
          size="small"
          color="primary"
          variant="outlined"
          sx={{ mt: 1 }}
        />
      )}
    </Box>
  );
}
