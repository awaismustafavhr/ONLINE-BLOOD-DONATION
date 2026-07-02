import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { 
  FaCog, 
  FaBell, 
  FaShieldAlt, 
  FaEye, 
  FaEyeSlash, 
  FaSave, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaInfoCircle,
  FaToggleOn,
  FaToggleOff,
  FaGlobe,
  FaMobile,
  FaEnvelope,
  FaMapMarkerAlt,
  FaClock,
  FaLanguage,
  FaPalette,
  FaMoon,
  FaSun
} from 'react-icons/fa';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { userAPI } from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Toggle from '../../components/ui/Toggle';
import Badge from '../../components/ui/Badge';

const SettingsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    // General settings
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    
    // Notification settings
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    bloodRequestNotifications: true,
    donationUpdateNotifications: true,
    systemAlertNotifications: true,
    marketingEmails: false,
    
    // Privacy settings
    profileVisibility: 'public',
    showLocation: true,
    showContactInfo: false,
    showDonationHistory: true,
    allowDirectMessages: true,
    
    // Security settings
    twoFactorAuth: false,
    loginNotifications: true,
    sessionTimeout: 30,
    
    // Appearance settings
    theme: 'light',
    fontSize: 'medium',
    colorScheme: 'default'
  });

  // Fetch user preferences
  const { data: preferencesData, isLoading: preferencesLoading } = useQuery(
    'user-preferences',
    () => userAPI.getPreferences(),
    {
      onSuccess: (data) => {
        if (data.data) {
          setSettings(prev => ({ ...prev, ...data.data }));
        }
      }
    }
  );

  // Update preferences mutation
  const updatePreferencesMutation = useMutation(
    (preferences) => userAPI.updatePreferences(preferences),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('user-preferences');
      },
    }
  );

  // Handle setting change
  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle save settings
  const handleSaveSettings = () => {
    updatePreferencesMutation.mutate(settings);
  };

  // Get tab options
  const tabOptions = [
    { id: 'general', label: 'General', icon: FaCog },
    { id: 'notifications', label: 'Notifications', icon: FaBell },
    { id: 'privacy', label: 'Privacy', icon: FaShieldAlt },
    { id: 'security', label: 'Security', icon: FaShieldAlt },
    { id: 'appearance', label: 'Appearance', icon: FaPalette }
  ];

  if (preferencesLoading) {
    return <LoadingSpinner fullScreen text="Loading settings..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
          <p className="text-neutral-600 mt-1">
            Customize your BloodLink experience
          </p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          <Button
            onClick={handleSaveSettings}
            isLoading={updatePreferencesMutation.isLoading}
            className="flex items-center space-x-2"
          >
            <FaSave />
            <span>Save Changes</span>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <div className="flex flex-wrap gap-2">
          {tabOptions.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                activeTab === tab.id
                  ? 'bg-blood-100 text-blood-700 border border-blood-200'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <tab.icon />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center">
              <FaCog className="mr-2 text-blood-600" />
              General Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Language
                </label>
                <Select
                  value={settings.language}
                  onChange={(e) => handleSettingChange('language', e.target.value)}
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'es', label: 'Spanish' },
                    { value: 'fr', label: 'French' },
                    { value: 'de', label: 'German' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Timezone
                </label>
                <Select
                  value={settings.timezone}
                  onChange={(e) => handleSettingChange('timezone', e.target.value)}
                  options={[
                    { value: 'UTC', label: 'UTC' },
                    { value: 'America/New_York', label: 'Eastern Time' },
                    { value: 'America/Chicago', label: 'Central Time' },
                    { value: 'America/Denver', label: 'Mountain Time' },
                    { value: 'America/Los_Angeles', label: 'Pacific Time' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Date Format
                </label>
                <Select
                  value={settings.dateFormat}
                  onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
                  options={[
                    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Time Format
                </label>
                <Select
                  value={settings.timeFormat}
                  onChange={(e) => handleSettingChange('timeFormat', e.target.value)}
                  options={[
                    { value: '12h', label: '12 Hour (AM/PM)' },
                    { value: '24h', label: '24 Hour' }
                  ]}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center">
              <FaBell className="mr-2 text-blood-600" />
              Notification Settings
            </h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-neutral-900 mb-4">Notification Channels</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FaEnvelope className="text-blue-600" />
                      <div>
                        <p className="font-medium text-neutral-900">Email Notifications</p>
                        <p className="text-sm text-neutral-600">Receive notifications via email</p>
                      </div>
                    </div>
                    <Toggle
                      checked={settings.emailNotifications}
                      onChange={(checked) => handleSettingChange('emailNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FaMobile className="text-green-600" />
                      <div>
                        <p className="font-medium text-neutral-900">SMS Notifications</p>
                        <p className="text-sm text-neutral-600">Receive notifications via SMS</p>
                      </div>
                    </div>
                    <Toggle
                      checked={settings.smsNotifications}
                      onChange={(checked) => handleSettingChange('smsNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <FaBell className="text-purple-600" />
                      <div>
                        <p className="font-medium text-neutral-900">Push Notifications</p>
                        <p className="text-sm text-neutral-600">Receive push notifications in browser</p>
                      </div>
                    </div>
                    <Toggle
                      checked={settings.pushNotifications}
                      onChange={(checked) => handleSettingChange('pushNotifications', checked)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-neutral-900 mb-4">Notification Types</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">Blood Request Notifications</p>
                      <p className="text-sm text-neutral-600">Get notified about new blood requests</p>
                    </div>
                    <Toggle
                      checked={settings.bloodRequestNotifications}
                      onChange={(checked) => handleSettingChange('bloodRequestNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">Donation Update Notifications</p>
                      <p className="text-sm text-neutral-600">Get notified about donation status updates</p>
                    </div>
                    <Toggle
                      checked={settings.donationUpdateNotifications}
                      onChange={(checked) => handleSettingChange('donationUpdateNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">System Alert Notifications</p>
                      <p className="text-sm text-neutral-600">Get notified about system alerts and updates</p>
                    </div>
                    <Toggle
                      checked={settings.systemAlertNotifications}
                      onChange={(checked) => handleSettingChange('systemAlertNotifications', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">Marketing Emails</p>
                      <p className="text-sm text-neutral-600">Receive promotional emails and updates</p>
                    </div>
                    <Toggle
                      checked={settings.marketingEmails}
                      onChange={(checked) => handleSettingChange('marketingEmails', checked)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Privacy Settings */}
      {activeTab === 'privacy' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center">
              <FaShieldAlt className="mr-2 text-blood-600" />
              Privacy Settings
            </h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Profile Visibility
                </label>
                <Select
                  value={settings.profileVisibility}
                  onChange={(e) => handleSettingChange('profileVisibility', e.target.value)}
                  options={[
                    { value: 'public', label: 'Public - Visible to everyone' },
                    { value: 'donors', label: 'Donors Only - Visible to other donors' },
                    { value: 'private', label: 'Private - Only visible to you' }
                  ]}
                />
              </div>

              <div>
                <h4 className="font-medium text-neutral-900 mb-4">Information Sharing</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">Show Location</p>
                      <p className="text-sm text-neutral-600">Allow others to see your general location</p>
                    </div>
                    <Toggle
                      checked={settings.showLocation}
                      onChange={(checked) => handleSettingChange('showLocation', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">Show Contact Information</p>
                      <p className="text-sm text-neutral-600">Allow others to see your contact details</p>
                    </div>
                    <Toggle
                      checked={settings.showContactInfo}
                      onChange={(checked) => handleSettingChange('showContactInfo', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">Show Donation History</p>
                      <p className="text-sm text-neutral-600">Allow others to see your donation history</p>
                    </div>
                    <Toggle
                      checked={settings.showDonationHistory}
                      onChange={(checked) => handleSettingChange('showDonationHistory', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">Allow Direct Messages</p>
                      <p className="text-sm text-neutral-600">Allow other users to send you direct messages</p>
                    </div>
                    <Toggle
                      checked={settings.allowDirectMessages}
                      onChange={(checked) => handleSettingChange('allowDirectMessages', checked)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center">
              <FaShieldAlt className="mr-2 text-blood-600" />
              Security Settings
            </h3>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Two-Factor Authentication</p>
                  <p className="text-sm text-neutral-600">Add an extra layer of security to your account</p>
                </div>
                <Toggle
                  checked={settings.twoFactorAuth}
                  onChange={(checked) => handleSettingChange('twoFactorAuth', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-neutral-900">Login Notifications</p>
                  <p className="text-sm text-neutral-600">Get notified when someone logs into your account</p>
                </div>
                <Toggle
                  checked={settings.loginNotifications}
                  onChange={(checked) => handleSettingChange('loginNotifications', checked)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Session Timeout (minutes)
                </label>
                <Select
                  value={settings.sessionTimeout}
                  onChange={(e) => handleSettingChange('sessionTimeout', parseInt(e.target.value))}
                  options={[
                    { value: 15, label: '15 minutes' },
                    { value: 30, label: '30 minutes' },
                    { value: 60, label: '1 hour' },
                    { value: 120, label: '2 hours' },
                    { value: 480, label: '8 hours' }
                  ]}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Appearance Settings */}
      {activeTab === 'appearance' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center">
              <FaPalette className="mr-2 text-blood-600" />
              Appearance Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Theme
                </label>
                <Select
                  value={settings.theme}
                  onChange={(e) => handleSettingChange('theme', e.target.value)}
                  options={[
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                    { value: 'auto', label: 'Auto (System)' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Font Size
                </label>
                <Select
                  value={settings.fontSize}
                  onChange={(e) => handleSettingChange('fontSize', e.target.value)}
                  options={[
                    { value: 'small', label: 'Small' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'large', label: 'Large' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Color Scheme
                </label>
                <Select
                  value={settings.colorScheme}
                  onChange={(e) => handleSettingChange('colorScheme', e.target.value)}
                  options={[
                    { value: 'default', label: 'Default' },
                    { value: 'blood', label: 'Blood Red' },
                    { value: 'blue', label: 'Blue' },
                    { value: 'green', label: 'Green' }
                  ]}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Success Message */}
      {updatePreferencesMutation.isSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3"
        >
          <FaCheckCircle className="text-green-600" />
          <p className="text-green-800">Settings saved successfully!</p>
        </motion.div>
      )}

      {/* Error Message */}
      {updatePreferencesMutation.isError && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3"
        >
          <FaExclamationTriangle className="text-red-600" />
          <p className="text-red-800">Failed to save settings. Please try again.</p>
        </motion.div>
      )}
    </div>
  );
};

export default SettingsPage;