import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Shield,
  Add,
  Edit,
  Delete,
  Save,
  Cancel,
  Check,
  Close,
  People,
  Settings,
} from '@mui/icons-material';
import { useDataProvider, useNotify, useRefresh } from 'react-admin';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  resource: string;
  action: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  userCount: number;
  createdAt: string;
  updatedAt: string;
  parentRole?: string;
}

interface RoleManagementProps {
  roles?: Role[];
  permissions?: Permission[];
}

const RoleManagement: React.FC<RoleManagementProps> = () => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Role>>({});
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesResponse, permissionsResponse] = await Promise.all([
        dataProvider.getList('roles', { 
          pagination: { page: 1, perPage: 100 },
          sort: { field: 'createdAt', order: 'ASC' }
        }),
        fetch('/api/admin/permissions').then(res => res.json())
      ]);

      setRoles(rolesResponse.data);
      setPermissions(permissionsResponse.data || []);
    } catch (error) {
      notify('获取角色数据失败', { type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setEditForm({
      name: role.name,
      description: role.description,
    });
    setEditDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!selectedRole) return;

    try {
      await dataProvider.update('roles', {
        id: selectedRole.id,
        data: editForm,
        previousData: selectedRole,
      });
      
      notify('角色更新成功', { type: 'success' });
      setEditDialogOpen(false);
      refresh();
    } catch (error) {
      notify('角色更新失败', { type: 'error' });
    }
  };

  const handleManagePermissions = (role: Role) => {
    setSelectedRole(role);
    setSelectedPermissions([...role.permissions]);
    setPermissionDialogOpen(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;

    try {
      const response = await fetch(`/api/admin/roles/${selectedRole.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: selectedPermissions }),
      });

      if (response.ok) {
        notify('权限更新成功', { type: 'success' });
        setPermissionDialogOpen(false);
        refresh();
      } else {
        notify('权限更新失败', { type: 'error' });
      }
    } catch (error) {
      notify('权限更新失败', { type: 'error' });
    }
  };

  const getPermissionCategories = () => {
    const categories = new Set(permissions.map(p => p.category));
    return Array.from(categories);
  };

  const getPermissionsByCategory = (category: string) => {
    return permissions.filter(p => p.category === category);
  };

  const togglePermission = (permissionName: string) => {
    setSelectedPermissions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(permissionName)) {
        newSet.delete(permissionName);
      } else {
        newSet.add(permissionName);
      }
      return Array.from(newSet);
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        角色管理
      </Typography>

      <Grid container spacing={3}>
        {roles.map((role) => (
          <Grid item xs={12} md={6} lg={4} key={role.id}>
            <Card 
              sx={{ 
                height: '100%',
                border: selectedRole?.id === role.id ? 2 : 1,
                borderColor: selectedRole?.id === role.id ? 'primary.main' : 'grey.300',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box>
                    <Typography variant="h6" component="div">
                      {role.name}
                      {role.isSystem && (
                        <Chip 
                          label="系统角色" 
                          size="small" 
                          color="info" 
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {role.description || '无描述'}
                    </Typography>
                  </Box>
                  <Shield color={role.isSystem ? 'disabled' : 'primary'} />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    <People sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    用户数: {role.userCount}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    权限 ({role.permissions.length}):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {role.permissions.slice(0, 6).map((permission) => (
                      <Chip 
                        key={permission} 
                        label={permission.split(':')[1]} 
                        size="small" 
                        variant="outlined"
                      />
                    ))}
                    {role.permissions.length > 6 && (
                      <Chip 
                        label={`+${role.permissions.length - 6}`} 
                        size="small" 
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Settings />}
                    onClick={() => handleManagePermissions(role)}
                    disabled={role.isSystem}
                  >
                    管理权限
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => handleEditRole(role)}
                    disabled={role.isSystem}
                  >
                    编辑
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>编辑角色</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="角色名称"
            value={editForm.name || ''}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            margin="normal"
            disabled={selectedRole?.isSystem}
          />
          <TextField
            fullWidth
            label="角色描述"
            value={editForm.description || ''}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>取消</Button>
          <Button onClick={handleSaveRole} variant="contained" startIcon={<Save />}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permission Management Dialog */}
      <Dialog 
        open={permissionDialogOpen} 
        onClose={() => setPermissionDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx: { height: '80vh' } }}
      >
        <DialogTitle>
          管理权限 - {selectedRole?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              已选择 {selectedPermissions.length} 个权限
            </Typography>
          </Box>
          
          <Tabs defaultValue="all" sx={{ mb: 2 }}>
            <Tab label="全部权限" value="all" />
            {getPermissionCategories().map(category => (
              <Tab key={category} label={category} value={category} />
            ))}
          </Tabs>

          <Box sx={{ maxHeight: 'calc(80vh - 200px)', overflowY: 'auto' }}>
            {getPermissionCategories().map(category => (
              <Box key={category} sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {category}
                </Typography>
                <Grid container spacing={1}>
                  {getPermissionsByCategory(category).map(permission => (
                    <Grid item xs={12} sm={6} md={4} key={permission.id}>
                      <Card 
                        variant="outlined" 
                        sx={{ 
                          cursor: 'pointer',
                          borderColor: selectedPermissions.includes(permission.name) ? 'primary.main' : 'grey.300',
                          bgcolor: selectedPermissions.includes(permission.name) ? 'primary.50' : 'background.paper',
                        }}
                        onClick={() => togglePermission(permission.name)}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2">
                              {permission.name.split(':')[1]}
                            </Typography>
                            {selectedPermissions.includes(permission.name) && (
                              <Check color="primary" sx={{ fontSize: 18 }} />
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {permission.description}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermissionDialogOpen(false)}>取消</Button>
          <Button 
            onClick={handleSavePermissions} 
            variant="contained" 
            startIcon={<Save />}
            disabled={selectedRole?.isSystem}
          >
            保存权限
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RoleManagement;