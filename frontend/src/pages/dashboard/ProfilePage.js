import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { 
  FaUser, 
  FaEdit, 
  FaSave, 
  FaTimes, 
  FaCamera, 
  FaEnvelope, 
  FaPhone, 
  FaHeart, 
  FaCalendarAlt, 
  FaShieldAlt, 
  FaUserMd, 
  FaUserShield, 
  FaHandHoldingHeart,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaExclamationTriangle,
  FaDownload,
  FaTimes as FaClose,
  FaSpinner
} from 'react-icons/fa';
import { useMutation, useQueryClient } from 'react-query';
import { userAPI } from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

const ProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false);
  const [, setProfilePictureFile] = useState(null);
  const [isUploadingProfilePicture, setIsUploadingProfilePicture] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '',
    email: user?.email || '',
    phone: user?.phone || '',
    bloodType: user?.bloodType || '',
    medicalHistory: user?.medicalHistory || {
      hasDiabetes: false,
      hasHypertension: false,
      hasHeartDisease: false,
      hasCancer: false,
      hasHepatitis: false,
      hasHIV: false,
      hasTuberculosis: false,
      hasEpilepsy: false,
      hasAsthma: false,
      hasAllergies: false,
      allergiesDescription: '',
      medications: [],
      lastDonationDate: null,
      totalDonations: 0
    },
    location: user?.location || ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Update profile mutation
  const updateProfileMutation = useMutation(
    (profileData) => userAPI.updateUser(user.id, profileData),
    {
      onSuccess: (response) => {
        // Use the AuthContext updateProfile function
        updateProfile(response.data.user);
        queryClient.invalidateQueries('user-profile');
        setIsEditing(false);
      },
      onError: (error) => {
        const message = error.response?.data?.message || 'Profile update failed';
        toast.error(message);
      },
    }
  );

  // Change password mutation
  const changePasswordMutation = useMutation(
    (passwordData) => userAPI.changePassword(passwordData),
    {
      onSuccess: () => {
        setShowPasswordModal(false);
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      },
    }
  );

  // Delete account mutation
  const deleteAccountMutation = useMutation(
    () => userAPI.deleteAccount(),
    {
      onSuccess: () => {
        // Handle account deletion (logout, redirect, etc.)
        window.location.href = '/';
      },
    }
  );

  // Profile picture upload mutation
  const uploadProfilePictureMutation = useMutation(
    (formData) => userAPI.updateProfilePicture(user.id, formData),
    {
      onSuccess: (data) => {
        // Update user with new profile picture URL
        const updatedUser = { ...user, profilePicture: data.data.profilePicture };
        updateProfile(updatedUser);
        setProfilePictureFile(null);
        setIsUploadingProfilePicture(false);
        queryClient.invalidateQueries('currentUser');
      },
      onError: (error) => {
        setIsUploadingProfilePicture(false);
        console.error('Profile picture upload error:', error);
      },
    }
  );

  // Get role icon
  const getRoleIcon = (role) => {
    switch (role) {
      case 'system_admin':
        return FaUserShield;
      case 'medical_admin':
        return FaUserMd;
      case 'donor':
        return FaHeart;
      case 'recipient':
        return FaHandHoldingHeart;
      default:
        return FaUser;
    }
  };

  // Get role color
  const getRoleColor = (role) => {
    switch (role) {
      case 'system_admin':
        return 'bg-red-100 text-red-800';
      case 'medical_admin':
        return 'bg-blue-100 text-blue-800';
      case 'donor':
        return 'bg-green-100 text-green-800';
      case 'recipient':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get blood type color
  const getBloodTypeColor = (bloodType) => {
    const colors = {
      'A+': 'bg-red-100 text-red-800',
      'A-': 'bg-red-200 text-red-900',
      'B+': 'bg-blue-100 text-blue-800',
      'B-': 'bg-blue-200 text-blue-900',
      'AB+': 'bg-purple-100 text-purple-800',
      'AB-': 'bg-purple-200 text-purple-900',
      'O+': 'bg-green-100 text-green-800',
      'O-': 'bg-green-200 text-green-900'
    };
    return colors[bloodType] || 'bg-gray-100 text-gray-800';
  };

  // Handle form change
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Handle password change
  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Split name into firstName and lastName
    const nameParts = formData.name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Prepare data for backend
    const profileData = {
      firstName,
      lastName,
      email: formData.email,
      phone: formData.phone,
      bloodType: formData.bloodType,
      medicalHistory: formData.medicalHistory,
      location: formData.location
    };
    
    updateProfileMutation.mutate(profileData);
  };

  // Handle password submit
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    
    changePasswordMutation.mutate(passwordData);
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setFormData({
      name: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '',
      email: user?.email || '',
      phone: user?.phone || '',
      bloodType: user?.bloodType || '',
      medicalHistory: user?.medicalHistory || {
        hasDiabetes: false,
        hasHypertension: false,
        hasHeartDisease: false,
        hasCancer: false,
        hasHepatitis: false,
        hasHIV: false,
        hasTuberculosis: false,
        hasEpilepsy: false,
        hasAsthma: false,
        hasAllergies: false,
        allergiesDescription: '',
        medications: [],
        lastDonationDate: null,
        totalDonations: 0
      },
      location: user?.location || ''
    });
    setIsEditing(false);
  };

  // Handle delete account
  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate();
  };

  // Profile picture handlers
  const handleProfilePictureClick = () => {
    if (user?.profilePicture) {
      setShowProfilePictureModal(true);
    }
  };

  const handleProfilePictureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      
      setProfilePictureFile(file);
      setIsUploadingProfilePicture(true);
      
      uploadProfilePictureMutation.mutate(file);
    }
  };

  const handleDownloadProfilePicture = () => {
    if (user?.profilePicture) {
      const link = document.createElement('a');
      link.href = user.profilePicture;
      link.download = `profile-picture-${user.firstName}-${user.lastName}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Handle medical history changes
  const handleMedicalHistoryChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        [field]: value
      }
    }));
  };

  // Handle medication changes
  const handleMedicationChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        medications: prev.medicalHistory.medications.map((med, i) => 
          i === index ? value : med
        )
      }
    }));
  };

  // Add new medication
  const addMedication = () => {
    setFormData(prev => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        medications: [...prev.medicalHistory.medications, '']
      }
    }));
  };

  // Remove medication
  const removeMedication = (index) => {
    setFormData(prev => ({
      ...prev,
      medicalHistory: {
        ...prev.medicalHistory,
        medications: prev.medicalHistory.medications.filter((_, i) => i !== index)
      }
    }));
  };

  // Toggle password visibility
  const togglePasswordVisibility = (field) => {
    setShowPasswords({
      ...showPasswords,
      [field]: !showPasswords[field]
    });
  };

  if (!user) {
    return <LoadingSpinner fullScreen text="Loading profile..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Profile</h1>
          <p className="text-neutral-600 mt-1">
            Manage your account information and settings
          </p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          {!isEditing ? (
            <Button
              onClick={() => setIsEditing(true)}
              className="flex items-center space-x-2"
            >
              <FaEdit />
              <span>Edit Profile</span>
            </Button>
          ) : (
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleCancelEdit}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <FaTimes />
                <span>Cancel</span>
              </Button>
              <Button
                onClick={handleSubmit}
                isLoading={updateProfileMutation.isLoading}
                className="flex items-center space-x-2"
              >
                <FaSave />
                <span>Save Changes</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:space-x-6">
          {/* Profile Picture */}
          <div className="flex-shrink-0 mb-6 md:mb-0">
            <div className="relative">
              <div 
                className="h-32 w-32 rounded-full bg-blood-100 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={handleProfilePictureClick}
              >
                {user?.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={`${user.firstName} ${user.lastName}`}
                    className="h-32 w-32 rounded-full object-cover"
                  />
                ) : (
                  React.createElement(getRoleIcon(user.role), {
                    className: "h-16 w-16 text-blood-600"
                  })
                )}
              </div>
              
              {/* Upload Button */}
              <label className="absolute bottom-0 right-0 bg-blood-600 text-white p-2 rounded-full hover:bg-blood-700 transition-colors cursor-pointer">
                {isUploadingProfilePicture ? (
                  <FaSpinner className="h-4 w-4 animate-spin" />
                ) : (
                  <FaCamera className="h-4 w-4" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureUpload}
                  className="hidden"
                  disabled={isUploadingProfilePicture}
                />
              </label>
            </div>
            
            {/* Profile Picture Info */}
            <div className="mt-2 text-center">
              <p className="text-sm text-neutral-600">
                {user?.profilePicture ? 'Click to view full size' : 'Upload a profile picture'}
              </p>
            </div>
          </div>

          {/* Profile Details */}
          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Full Name
                </label>
                {isEditing ? (
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                  />
                ) : (
                  <p className="text-neutral-900">{user.firstName} {user.lastName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Email
                </label>
                {isEditing ? (
                  <Input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                  />
                ) : (
                  <p className="text-neutral-900 flex items-center">
                    <FaEnvelope className="h-4 w-4 mr-2 text-neutral-400" />
                    {user.email}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Contact Number
                </label>
                {isEditing ? (
                  <Input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter your contact number"
                  />
                ) : (
                  <p className="text-neutral-900 flex items-center">
                    <FaPhone className="h-4 w-4 mr-2 text-neutral-400" />
                    {user.phone || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Role
                </label>
                <Badge className={getRoleColor(user.role)}>
                  {user.role.replace('_', ' ')}
                </Badge>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Blood Type
                </label>
                {isEditing ? (
                  <Select
                    name="bloodType"
                    value={formData.bloodType}
                    onChange={handleChange}
                    options={[
                      { value: '', label: 'Select Blood Type' },
                      { value: 'A+', label: 'A+' },
                      { value: 'A-', label: 'A-' },
                      { value: 'B+', label: 'B+' },
                      { value: 'B-', label: 'B-' },
                      { value: 'AB+', label: 'AB+' },
                      { value: 'AB-', label: 'AB-' },
                      { value: 'O+', label: 'O+' },
                      { value: 'O-', label: 'O-' }
                    ]}
                  />
                ) : (
                  user.bloodType ? (
                    <Badge className={getBloodTypeColor(user.bloodType)}>
                      {user.bloodType}
                    </Badge>
                  ) : (
                    <p className="text-neutral-500">Not specified</p>
                  )
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Member Since
                </label>
                <p className="text-neutral-900 flex items-center">
                  <FaCalendarAlt className="h-4 w-4 mr-2 text-neutral-400" />
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Medical History */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Medical History
              </label>
              {isEditing ? (
                <div className="bg-neutral-50 p-4 rounded-lg space-y-4">
                  {/* Medical Conditions */}
                  <div>
                    <h4 className="font-medium text-neutral-800 mb-3">Medical Conditions</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { key: 'hasDiabetes', label: 'Diabetes' },
                        { key: 'hasHypertension', label: 'Hypertension' },
                        { key: 'hasHeartDisease', label: 'Heart Disease' },
                        { key: 'hasCancer', label: 'Cancer' },
                        { key: 'hasHepatitis', label: 'Hepatitis' },
                        { key: 'hasHIV', label: 'HIV' },
                        { key: 'hasTuberculosis', label: 'Tuberculosis' },
                        { key: 'hasEpilepsy', label: 'Epilepsy' },
                        { key: 'hasAsthma', label: 'Asthma' },
                        { key: 'hasAllergies', label: 'Allergies' }
                      ].map(({ key, label }) => (
                        <label key={key} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.medicalHistory[key] || false}
                            onChange={(e) => handleMedicalHistoryChange(key, e.target.checked)}
                            className="w-4 h-4 text-blood-600 border-neutral-300 rounded focus:ring-blood-500"
                          />
                          <span className="text-sm text-neutral-700">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Allergies Description */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Allergies Description
                    </label>
                    <textarea
                      value={formData.medicalHistory.allergiesDescription || ''}
                      onChange={(e) => handleMedicalHistoryChange('allergiesDescription', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
                      placeholder="Describe any allergies you have..."
                    />
                  </div>

                  {/* Medications */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-neutral-700">
                        Current Medications
                      </label>
                      <button
                        type="button"
                        onClick={addMedication}
                        className="text-sm text-blood-600 hover:text-blood-700 font-medium"
                      >
                        + Add Medication
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formData.medicalHistory.medications?.map((medication, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={medication}
                            onChange={(e) => handleMedicationChange(index, e.target.value)}
                            className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
                            placeholder="Enter medication name..."
                          />
                          <button
                            type="button"
                            onClick={() => removeMedication(index)}
                            className="p-2 text-red-600 hover:text-red-700"
                          >
                            <FaTimes className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      {(!formData.medicalHistory.medications || formData.medicalHistory.medications.length === 0) && (
                        <p className="text-sm text-neutral-500 italic">No medications added</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-neutral-900 bg-neutral-50 p-3 rounded-lg">
                  {user.medicalHistory ? (
                    <div className="space-y-2">
                      <h4 className="font-medium text-neutral-800 mb-2">Medical Conditions:</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(user.medicalHistory).map(([key, value]) => {
                          if (typeof value === 'boolean') {
                            const conditionName = key.replace('has', '').replace(/([A-Z])/g, ' $1').trim();
                            return (
                              <div key={key} className="flex items-center space-x-2">
                                <span className={`w-2 h-2 rounded-full ${value ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                <span className={value ? 'text-red-700' : 'text-green-700'}>
                                  {conditionName}: {value ? 'Yes' : 'No'}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                      {user.medicalHistory?.medications && user.medicalHistory.medications.length > 0 && (
                        <div className="mt-3">
                          <h5 className="font-medium text-neutral-800 mb-1">Medications:</h5>
                          <div className="text-sm text-neutral-600">
                            {Array.isArray(user.medicalHistory.medications) ? (
                              <ul className="list-disc list-inside space-y-1">
                                {user.medicalHistory.medications.map((medication, index) => (
                                  <li key={index}>{medication}</li>
                                ))}
                              </ul>
                            ) : (
                              <p>{String(user.medicalHistory.medications)}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {user.medicalHistory?.allergiesDescription && (
                        <div className="mt-3">
                          <h5 className="font-medium text-neutral-800 mb-1">Allergies:</h5>
                          <p className="text-sm text-neutral-600">{String(user.medicalHistory.allergiesDescription)}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    'No medical history provided'
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Account Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center">
          <FaShieldAlt className="mr-2 text-blood-600" />
          Account Settings
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg">
            <div>
              <h4 className="font-medium text-neutral-900">Change Password</h4>
              <p className="text-sm text-neutral-600">Update your account password</p>
            </div>
            <Button
              onClick={() => setShowPasswordModal(true)}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <FaLock />
              <span>Change Password</span>
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-neutral-200 rounded-lg">
            <div>
              <h4 className="font-medium text-neutral-900">Delete Account</h4>
              <p className="text-sm text-neutral-600">Permanently delete your account</p>
            </div>
            <Button
              onClick={() => setShowDeleteModal(true)}
              variant="danger"
              className="flex items-center space-x-2"
            >
              <FaTimes />
              <span>Delete Account</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
        size="md"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                className="w-full px-3 py-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPasswords.current ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                className="w-full px-3 py-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPasswords.new ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                className="w-full px-3 py-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showPasswords.confirm ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPasswordModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={changePasswordMutation.isLoading}
            >
              Change Password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Account"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3 text-red-600">
            <FaExclamationTriangle className="text-xl" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          
          <p className="text-neutral-600">
            Are you sure you want to delete your account? This will permanently remove all your data including donations, requests, and profile information.
          </p>
          
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              isLoading={deleteAccountMutation.isLoading}
            >
              Delete Account
            </Button>
          </div>
        </div>
      </Modal>

      {/* Profile Picture Modal */}
      <Modal
        isOpen={showProfilePictureModal}
        onClose={() => setShowProfilePictureModal(false)}
        title="Profile Picture"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <img
              src={user?.profilePicture}
              alt={`${user?.firstName} ${user?.lastName}`}
              className="max-w-full max-h-96 rounded-lg shadow-lg"
            />
          </div>
          
          <div className="flex justify-center space-x-4">
            <Button
              onClick={handleDownloadProfilePicture}
              className="flex items-center space-x-2"
            >
              <FaDownload />
              <span>Download</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowProfilePictureModal(false)}
              className="flex items-center space-x-2"
            >
              <FaClose />
              <span>Close</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProfilePage;