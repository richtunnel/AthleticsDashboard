"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
} from "@mui/material";
import { 
  ExpandLess, 
  ExpandMore, 
  Person, 
  CalendarMonth, 
  Group 
} from "@mui/icons-material";
import { ConnectedParentsMenu } from "../parents/ConnectedParentsMenu";

interface ParentsAndAthletesMenuProps {
  defaultOpen?: boolean;
}

export function ParentsAndAthletesMenu({ defaultOpen = false }: ParentsAndAthletesMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);

  const handleToggle = () => {
    setOpen(!open);
  };

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <ListItemButton onClick={handleToggle}>
        <ListItemIcon>
          <Person color="primary" />
        </ListItemIcon>
        <ListItemText 
          primary="Parents & Athletes" 
          secondary="Manage parent connections"
        />
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>
      
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ p: 2, pt: 0 }}>
          <ConnectedParentsMenu />
          
          <Button
            fullWidth
            variant="outlined"
            startIcon={<Group />}
            onClick={() => {
              // Open parent onboarding in a new tab or modal
              window.open("/onboarding/parent", "_blank");
            }}
            sx={{ mt: 2 }}
          >
            Share Parent Portal Link
          </Button>
        </Box>
      </Collapse>
    </Card>
  );
}
