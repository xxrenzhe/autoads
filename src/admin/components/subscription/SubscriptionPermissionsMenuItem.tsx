import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ListItem, 
  ListItemIcon, 
  ListItemText, 
  ListItemButton,
  Tooltip
} from '@mui/material';
import { Settings as SettingsIcon } from '@mui/icons-material';

const SubscriptionPermissionsMenuItem: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/subscription-permissions');
  };

  return (
    <Tooltip title="管理各套餐的功能权限配置" placement="right">
      <ListItem disablePadding>
        <ListItemButton onClick={handleClick}>
          <ListItemIcon>
            <SettingsIcon />
          </ListItemIcon>
          <ListItemText primary="套餐权限" />
        </ListItemButton>
      </ListItem>
    </Tooltip>
  );
};

export default SubscriptionPermissionsMenuItem;