"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, getSession } from "next-auth/react";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard,
  CalendarMonth,
  Chat,
  Settings,
  Logout,
  Person,
} from "@mui/icons-material";
import { VscGithubProject } from "react-icons/vsc";
import { CircularProjectIcon } from "../circle-logo/OpleticsLogo";
import styles from "../../styles/logo.module.css";

const drawerWidth = 240;

interface ParentDashboardLayoutClientProps {
  children: React.ReactNode;
}

export default function ParentDashboardLayoutClient({ children }: ParentDashboardLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  useEffect(() => {
    async function loadSession() {
      const session = await getSession();
      if (session?.user) {
        setUserName(session.user.name || "Parent");
        setUserEmail(session.user.email || "");
      }
    }
    loadSession();
  }, []);

  const menuItems = [
    { text: "Overview", icon: <Dashboard />, path: "/parent-dashboard" },
    { text: "Chat", icon: <Chat />, path: "/parent-dashboard/chat" },
    { text: "Settings", icon: <Settings />, path: "/parent-dashboard/settings" },
  ];

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleClose();
    await signOut({ callbackUrl: "/" });
  };

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
        <Link href="/parent-dashboard" className={`${styles["ad-hub-logo"]} flex d-flex`}>
          <CircularProjectIcon />
          <span style={{ marginLeft: "2.5px", color: theme.palette.text.primary }}>
            opletics
          </span>
        </Link>
      </Box>
      <Divider />
      <List sx={{ flex: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={pathname === item.path}
              onClick={() => {
                router.push(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              sx={{
                "&.Mui-selected": {
                  backgroundColor: theme.palette.primary.light + "20",
                  borderRight: `3px solid ${theme.palette.primary.main}`,
                },
              }}
            >
              <ListItemIcon sx={{ color: pathname === item.path ? theme.palette.primary.main : "inherit" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                primaryTypographyProps={{
                  fontWeight: pathname === item.path ? 600 : 400,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon>
              <Logout />
            </ListItemIcon>
            <ListItemText primary="Sign Out" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          boxShadow: 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={handleMenu} sx={{ p: 0 }}>
            <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
              {userName.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
          >
            <MenuItem disabled>
              <ListItemIcon>
                <Person fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={userName} secondary={userEmail} />
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Sign Out" />
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          mt: "64px",
          bgcolor: theme.palette.background.default,
          minHeight: "calc(100vh - 64px)",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
