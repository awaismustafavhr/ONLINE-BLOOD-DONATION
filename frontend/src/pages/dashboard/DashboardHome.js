import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { 
  FaHeart, 
  FaHandHoldingHeart, 
  FaUsers, 
  FaTint, 
  FaChartLine, 
  FaBell, 
  FaPlus, 
  FaEye, 
  FaMapMarkerAlt, 
  FaClock, 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaInfoCircle,
  FaArrowUp,
  FaArrowDown,
  FaMinus,
  FaCalendarAlt,
  FaUser,
  FaUserMd,
  FaUserShield,
  FaHospital,
  FaPhone,
  FaEnvelope
} from 'react-icons/fa';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { userAPI, bloodRequestAPI, donationAPI, notificationAPI } from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

const DashboardHome = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [selectedPeriod, setSelectedPeriod] = useState('30d');

  // Fetch dashboard data based on user role
  const { data: dashboardData, isLoading: dashboardLoading, error: dashboardError } = useQuery(
    ['dashboard-home', { period: selectedPeriod, role: user?.role }],
    async () => {
      let response;
      if (hasRole(['system_admin', 'medical_admin'])) {
        response = await userAPI.getAdminDashboard({ period: selectedPeriod });
      } else if (hasRole(['donor'])) {
        response = await userAPI.getDonorDashboard({ period: selectedPeriod });
      } else if (hasRole(['recipient'])) {
        response = await userAPI.getRecipientDashboard({ period: selectedPeriod });
      } else {
        return { data: {} };
      }
      
      // Debug: Log the response structure
      console.log('Dashboard API Response:', response);
      console.log('Response.data:', response?.data);
      console.log('Response.data.data:', response?.data?.data);
      console.log('Response.data.data.dashboard:', response?.data?.data?.dashboard);
      
      // Return the unwrapped data
      return response.data;
    },
    {
      enabled: !!user && (user?.role === 'donor' || user?.role === 'recipient' || user?.role === 'system_admin' || user?.role === 'medical_admin'),
      refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
      onError: (error) => {
        console.error('Dashboard query error:', error);
        console.error('Error response:', error?.response);
      }
    }
  );

  // Fetch recent notifications
  const { data: notificationsData } = useQuery(
    'recent-notifications',
    () => notificationAPI.getNotifications({ limit: 5 }),
    {
      enabled: !!user,
      refetchInterval: 20000, // Refetch every 20 seconds for real-time updates
    }
  );

  // Debug: Log extracted dashboard data
  console.log('Raw dashboardData:', dashboardData);
  
  // Extract dashboard - handle both response formats
  // Backend returns: { success: true, data: { dashboard: {...} } }
  // After axios unwrap: { success: true, data: { dashboard: {...} } }
  const dashboard = dashboardData?.data?.dashboard || dashboardData?.dashboard || {};
  
  // Debug: Log extracted dashboard
  console.log('Extracted dashboard:', dashboard);
  console.log('Dashboard keys:', Object.keys(dashboard));
  console.log('Total donations:', dashboard.totalDonations);
  console.log('Blood collected:', dashboard.totalBloodCollected);
  console.log('Donations count:', dashboard.donationsCount);
  console.log('Last donation date:', dashboard.lastDonationDate);
  console.log('Blood type:', dashboard.bloodType);
  console.log('Eligibility:', dashboard.eligibility);
  
  // Notifications API returns { success: true, data: { notifications: [...], unreadCount, pagination } }
  const notificationsResponse = notificationsData?.data?.data || notificationsData?.data || {};
  const notifications = Array.isArray(notificationsResponse.notifications) ? notificationsResponse.notifications : [];

  // Urgency helpers: prefer top-level, then overview, then distributions
  const urgencyDistributionArr = dashboard?.distributions?.urgency || [];
  const urgencyFromDistribution = urgencyDistributionArr.reduce((acc, item) => {
    if (!item || typeof item._id !== 'string') return acc;
    acc[item._id] = item.count || 0;
    return acc;
  }, {});
  const criticalUrgency = dashboard.criticalRequests ?? dashboard.overview?.criticalRequests ?? urgencyFromDistribution.critical ?? 0;
  const highUrgency = dashboard.highUrgencyRequests ?? dashboard.overview?.highUrgencyRequests ?? urgencyFromDistribution.high ?? 0;
  const mediumUrgency = dashboard.mediumUrgencyRequests ?? dashboard.overview?.mediumUrgencyRequests ?? urgencyFromDistribution.medium ?? 0;
  const lowUrgency = dashboard.lowUrgencyRequests ?? dashboard.overview?.lowUrgencyRequests ?? urgencyFromDistribution.low ?? 0;

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

  // Calculate percentage change
  const calculatePercentageChange = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  // Get trend icon and color
  const getTrendIcon = (percentage) => {
    if (percentage > 0) {
      return { icon: FaArrowUp, color: 'text-green-600', bg: 'bg-green-100' };
    } else if (percentage < 0) {
      return { icon: FaArrowDown, color: 'text-red-600', bg: 'bg-red-100' };
    } else {
      return { icon: FaMinus, color: 'text-neutral-600', bg: 'bg-neutral-100' };
    }
  };

  if (dashboardLoading) {
    return <LoadingSpinner fullScreen text="Loading dashboard..." />;
  }

  // Show error if query failed
  if (dashboardError) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Dashboard</h3>
          <p className="text-red-700">
            {dashboardError?.response?.data?.message || dashboardError?.message || 'Failed to load dashboard data'}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blood-600 to-blood-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Welcome back, {user?.firstName}! 👋
            </h1>
            <p className="text-blood-100 mb-4">
              Here's what's happening with your blood donation activities today.
            </p>
            <div className="flex items-center space-x-2">
              {React.createElement(getRoleIcon(user?.role), {
                className: "h-5 w-5"
              })}
              <Badge className={getRoleColor(user?.role)}>
                {user?.role?.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0">
            <div className="flex items-center space-x-4">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-lg text-white focus:ring-2 focus:ring-white focus:ring-opacity-50"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="1y">Last Year</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {hasRole(['recipient']) && (
            <Button
              onClick={() => navigate('/dashboard/blood-requests')}
              className="flex items-center space-x-2 p-4 h-auto"
            >
              <FaPlus />
              <span>New Blood Request</span>
            </Button>
          )}
          
          {hasRole(['donor']) && (
            <Button
              onClick={() => navigate('/dashboard/donations')}
              variant="outline"
              className="flex items-center space-x-2 p-4 h-auto"
            >
              <FaHeart />
              <span>Record Donation</span>
            </Button>
          )}
          
          <Button
            onClick={() => navigate('/dashboard/notifications')}
            variant="outline"
            className="flex items-center space-x-2 p-4 h-auto"
          >
            <FaBell />
            <span>View Notifications</span>
          </Button>
          
          <Button
            onClick={() => navigate('/dashboard/profile')}
            variant="outline"
            className="flex items-center space-x-2 p-4 h-auto"
          >
            <FaUser />
            <span>Update Profile</span>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(hasRole(['recipient']) ? [
          {
            title: 'Total Requests',
            value: dashboard.totalRequests || 0,
            previous: dashboard.previousRequests || 0,
            icon: FaHandHoldingHeart,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: 'Pending Requests',
            value: dashboard.pendingRequests || 0,
            previous: 0,
            icon: FaClock,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100'
          },
          {
            title: 'Fulfilled Requests',
            value: dashboard.fulfilledRequests || 0,
            previous: 0,
            icon: FaCheckCircle,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          },
          {
            title: 'Urgent Requests',
            value: dashboard.urgentRequests || 0,
            previous: 0,
            icon: FaExclamationTriangle,
            color: 'text-red-600',
            bgColor: 'bg-red-100'
          }
        ] : hasRole(['donor']) ? [
          {
            title: 'My Donations',
            value: dashboard.totalDonations || 0,
            previous: dashboard.previousDonations || 0,
            icon: FaHeart,
            color: 'text-red-600',
            bgColor: 'bg-red-100'
          },
          {
            title: 'Blood Collected',
            value: dashboard.totalBloodCollected || 0,
            previous: dashboard.previousBloodCollected || 0,
            icon: FaTint,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
            suffix: 'ml'
          },
          {
            title: 'Total Donations',
            value: dashboard.donationsCount || 0,
            previous: 0,
            icon: FaHeart,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          },
          {
            title: 'Last Donation',
            value: dashboard.lastDonationDate ? 
              Math.floor((new Date() - new Date(dashboard.lastDonationDate)) / (1000 * 60 * 60 * 24)) : 
              'N/A',
            previous: 0,
            icon: FaCalendarAlt,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
            suffix: dashboard.lastDonationDate ? ' days ago' : ''
          }
        ] : hasRole(['system_admin', 'medical_admin']) ? [
          {
            title: 'Total Users',
            value: dashboard.totalUsers || 0,
            previous: dashboard.previousUsers || 0,
            icon: FaUsers,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: 'Active Users',
            value: dashboard.activeUsers || 0,
            previous: dashboard.previousUsers || 0,
            icon: FaUsers,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          },
          {
            title: 'Blood Requests',
            value: dashboard.totalRequests || 0,
            previous: dashboard.previousRequests || 0,
            icon: FaHandHoldingHeart,
            color: 'text-red-600',
            bgColor: 'bg-red-100'
          },
          {
            title: 'Total Donations',
            value: dashboard.totalDonations || 0,
            previous: dashboard.previousDonations || 0,
            icon: FaHeart,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
          }
        ] : [
          {
            title: hasRole(['donor']) ? 'My Donations' : 'Total Donations',
            value: dashboard.totalDonations || 0,
            previous: dashboard.previousDonations || 0,
            icon: FaHeart,
            color: 'text-red-600',
            bgColor: 'bg-red-100'
          },
          {
            title: hasRole(['recipient']) ? 'My Requests' : 'Blood Requests',
            value: dashboard.totalRequests || 0,
            previous: dashboard.previousRequests || 0,
            icon: FaHandHoldingHeart,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: 'Blood Collected',
            value: dashboard.totalBloodCollected || 0,
            previous: dashboard.previousBloodCollected || 0,
            icon: FaTint,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100',
            suffix: 'ml'
          },
          {
            title: 'Active Users',
            value: dashboard.activeUsers || 0,
            previous: dashboard.previousUsers || 0,
            icon: FaUsers,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          }
        ]).map((stat, index) => {
          const percentageChange = calculatePercentageChange(stat.value, stat.previous);
          const trend = getTrendIcon(percentageChange);

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`text-xl ${stat.color}`} />
                </div>
                <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${trend.bg}`}>
                  <trend.icon className={trend.color} />
                  <span className={trend.color}>
                    {Math.abs(percentageChange).toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div>
                <p className="text-2xl font-bold text-neutral-900 mb-1">
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}{stat.suffix || ''}
                </p>
                <p className="text-sm text-neutral-600">{stat.title}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Activity & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
            <FaClock className="mr-2 text-blood-600" />
            Recent Activity
          </h3>
          
          <div className="space-y-4">
            {dashboard.recentActivity && Array.isArray(dashboard.recentActivity) && dashboard.recentActivity.length > 0 ? (
              dashboard.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-4 p-3 border border-neutral-200 rounded-lg hover:bg-neutral-50">
                  <div className="text-2xl">{activity.icon || '📋'}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">
                      {activity.description || 'Activity'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : 'Recently'}
                    </p>
                  </div>
                  <Badge className={
                    activity.type === 'authentication' ? 'bg-blue-100 text-blue-800' :
                    activity.type === 'profile' ? 'bg-green-100 text-green-800' :
                    activity.type === 'donation' ? 'bg-red-100 text-red-800' :
                    activity.type === 'request' ? 'bg-purple-100 text-purple-800' :
                    activity.type === 'admin' ? 'bg-yellow-100 text-yellow-800' :
                    activity.type === 'medical' ? 'bg-pink-100 text-pink-800' :
                    'bg-neutral-100 text-neutral-800'
                  }>
                    {activity.type || 'activity'}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-neutral-500">
                <FaInfoCircle className="text-2xl mx-auto mb-2" />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
            <FaBell className="mr-2 text-blood-600" />
            Recent Notifications
          </h3>
          
          <div className="space-y-4">
            {notifications && Array.isArray(notifications) && notifications.length > 0 ? (
              notifications.map((notification) => (
                <div key={notification._id || notification.id} className="flex items-start space-x-3 p-3 border border-neutral-200 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    notification.read || notification.isRead ? 'bg-neutral-300' : 'bg-blue-500'
                  }`}></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">
                      {notification.message || notification.title || 'Notification'}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : 'Recently'}
                    </p>
                  </div>
                  <Badge className="bg-neutral-100 text-neutral-800">
                    {notification.type ? notification.type.replace('_', ' ') : 'notification'}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-neutral-500">
                <FaBell className="text-2xl mx-auto mb-2" />
                <p>No notifications</p>
              </div>
            )}
          </div>
          
          {notifications.length > 0 && (
            <div className="mt-4 pt-4 border-t border-neutral-200">
              <Button
                onClick={() => navigate('/dashboard/notifications')}
                variant="outline"
                className="w-full"
              >
                View All Notifications
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Role-specific Content */}
      {hasRole(['donor']) && (
        <>
          {/* Donor Information */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
              <FaHeart className="mr-2 text-red-600" />
              Donor Information
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {dashboard.daysSinceLastDonation !== null && dashboard.daysSinceLastDonation !== undefined ? 
                    dashboard.daysSinceLastDonation : 
                    'N/A'
                  }
                </div>
                <p className="text-sm text-neutral-600">Days since last donation</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {dashboard.completedDonationsCount || 0}
                </div>
                <p className="text-sm text-neutral-600">Completed donations</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {dashboard.bloodType || user?.bloodType || 'N/A'}
                </div>
                <p className="text-sm text-neutral-600">Blood type</p>
              </div>
            </div>

            {/* Eligibility Status */}
            <div className={`border rounded-lg p-4 ${
              dashboard.eligibility?.canDonate ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-start space-x-3">
                {dashboard.eligibility?.canDonate ? (
                  <FaCheckCircle className="text-green-600 text-xl mt-0.5" />
                ) : (
                  <FaExclamationTriangle className="text-yellow-600 text-xl mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold text-neutral-900 mb-1">
                    {dashboard.eligibility?.canDonate ? 'Eligible to Donate' : 'Not Currently Eligible'}
                  </h4>
                  {dashboard.eligibility?.reason && (
                    <p className="text-sm text-neutral-700">{dashboard.eligibility.reason}</p>
                  )}
                  {dashboard.eligibility?.warning && (
                    <p className="text-sm text-yellow-700">{dashboard.eligibility.warning}</p>
                  )}
                  {dashboard.nextEligibleDate && !dashboard.eligibility?.canDonate && (
                    <p className="text-sm text-neutral-600 mt-2">
                      Next eligible date: {new Date(dashboard.nextEligibleDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Donations */}
          {dashboard.upcomingDonations && dashboard.upcomingDonations.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
                <FaCalendarAlt className="mr-2 text-blue-600" />
                Upcoming Donations ({dashboard.upcomingDonationsCount || 0})
              </h3>
              
              <div className="space-y-3">
                {dashboard.upcomingDonations.map((donation) => (
                  <div key={donation._id} className="border border-neutral-200 rounded-lg p-4 hover:bg-neutral-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge className={
                            donation.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                            donation.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-neutral-100 text-neutral-800'
                          }>
                            {donation.status}
                          </Badge>
                          <span className="text-sm font-medium text-neutral-900">
                            {donation.donationType?.replace('_', ' ').toUpperCase() || 'Blood'}
                          </span>
                          <span className="text-sm text-neutral-600">
                            ({donation.bloodUnits || 1} unit{donation.bloodUnits > 1 ? 's' : ''})
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-neutral-600">
                          <div className="flex items-center space-x-1">
                            <FaCalendarAlt className="text-xs" />
                            <span>{new Date(donation.scheduledDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <FaClock className="text-xs" />
                            <span>{donation.scheduledTime || 'TBD'}</span>
                          </div>
                          {donation.collectionSite && (
                            <div className="flex items-center space-x-1">
                              <FaMapMarkerAlt className="text-xs" />
                              <span>{donation.collectionSite}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/dashboard/donations')}
                      >
                        <FaEye className="mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              {dashboard.upcomingDonationsCount > 5 && (
                <div className="mt-4 pt-4 border-t border-neutral-200">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard/donations')}
                    className="w-full"
                  >
                    View All Upcoming Donations
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {hasRole(['recipient']) && (
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
          <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
            <FaHandHoldingHeart className="mr-2 text-blue-600" />
            Request Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 mb-1">
                {dashboard.pendingRequests || 0}
              </div>
              <p className="text-sm text-neutral-600">Pending</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {dashboard.matchedRequests || 0}
              </div>
              <p className="text-sm text-neutral-600">Matched</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {dashboard.confirmedRequests || 0}
              </div>
              <p className="text-sm text-neutral-600">Confirmed</p>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {dashboard.fulfilledRequests || 0}
              </div>
              <p className="text-sm text-neutral-600">Fulfilled</p>
            </div>
          </div>
          
          {/* Urgency Levels */}
          <div className="mt-6 pt-6 border-t border-neutral-200">
            <h4 className="text-md font-semibold text-neutral-900 mb-4">Request Urgency</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-600 mb-1">
                  {dashboard.criticalRequests || 0}
                </div>
                <p className="text-xs text-neutral-600">Critical</p>
              </div>
              
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-xl font-bold text-orange-600 mb-1">
                  {dashboard.highUrgencyRequests || 0}
                </div>
                <p className="text-xs text-neutral-600">High</p>
              </div>
              
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-xl font-bold text-yellow-600 mb-1">
                  {dashboard.mediumUrgencyRequests || 0}
                </div>
                <p className="text-xs text-neutral-600">Medium</p>
              </div>
              
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600 mb-1">
                  {dashboard.lowUrgencyRequests || 0}
                </div>
                <p className="text-xs text-neutral-600">Low</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin-specific Content */}
      {hasRole(['system_admin', 'medical_admin']) && (
        <>
          {/* System Overview */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
              <FaChartLine className="mr-2 text-green-600" />
              System Overview
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {dashboard.totalUsers || 0}
                </div>
                <p className="text-sm text-neutral-600">Total users</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {dashboard.activeDonors || 0}
                </div>
                <p className="text-sm text-neutral-600">Active donors</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {dashboard.pendingVerifications || 0}
                </div>
                <p className="text-sm text-neutral-600">Pending verifications</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {dashboard.systemHealth || '99.9'}%
                </div>
                <p className="text-sm text-neutral-600">System health</p>
              </div>
            </div>

            {/* Additional Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {dashboard.newUsers || 0}
                </div>
                <p className="text-sm text-neutral-600">New users ({selectedPeriod})</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {dashboard.completedRequests || 0}
                </div>
                <p className="text-sm text-neutral-600">Fulfilled requests</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 mb-1">
                  {dashboard.pendingRequests || 0}
                </div>
                <p className="text-sm text-neutral-600">Pending</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {dashboard.matchedRequests || 0}
                </div>
                <p className="text-sm text-neutral-600">Matched</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 mb-1">
                  {criticalUrgency}
                </div>
                <p className="text-sm text-neutral-600">Critical urgency</p>
              </div>
            </div>
            
            {/* Request Status Breakdown */}
            <div className="mt-6 pt-6 border-t border-neutral-200">
              <h4 className="text-md font-semibold text-neutral-900 mb-4">Request Status Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-lg font-bold text-yellow-600 mb-1">
                    {dashboard.pendingRequests || 0}
                  </div>
                  <p className="text-xs text-neutral-600">Pending</p>
                </div>
                
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600 mb-1">
                    {dashboard.matchedRequests || 0}
                  </div>
                  <p className="text-xs text-neutral-600">Matched</p>
                </div>
                
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-lg font-bold text-purple-600 mb-1">
                    {dashboard.confirmedRequests || 0}
                  </div>
                  <p className="text-xs text-neutral-600">Confirmed</p>
                </div>
                
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600 mb-1">
                    {dashboard.completedRequests || 0}
                  </div>
                  <p className="text-xs text-neutral-600">Fulfilled</p>
                </div>
              </div>
            </div>
            
            {/* Urgency Levels */}
            <div className="mt-6 pt-6 border-t border-neutral-200">
              <h4 className="text-md font-semibold text-neutral-900 mb-4">Urgency Levels</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-lg font-bold text-red-600 mb-1">
                  {criticalUrgency}
                  </div>
                  <p className="text-xs text-neutral-600">Critical</p>
                </div>
                
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-lg font-bold text-orange-600 mb-1">
                  {highUrgency}
                  </div>
                  <p className="text-xs text-neutral-600">High</p>
                </div>
                
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <div className="text-lg font-bold text-yellow-600 mb-1">
                  {mediumUrgency}
                  </div>
                  <p className="text-xs text-neutral-600">Medium</p>
                </div>
                
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600 mb-1">
                  {lowUrgency}
                  </div>
                  <p className="text-xs text-neutral-600">Low</p>
                </div>
              </div>
            </div>
          </div>

          {/* Blood Collection & Success Rates */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
              <FaTint className="mr-2 text-red-600" />
              Blood Collection & Success Metrics
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {dashboard.totalBloodCollected ? dashboard.totalBloodCollected.toLocaleString() : 0}ml
                </div>
                <p className="text-sm text-neutral-600">Blood collected ({selectedPeriod})</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {dashboard.successfulDonations || 0}
                </div>
                <p className="text-sm text-neutral-600">Successful donations</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {dashboard.donationSuccessRate ? dashboard.donationSuccessRate.toFixed(1) : 0}%
                </div>
                <p className="text-sm text-neutral-600">Donation success rate</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {dashboard.requestSuccessRate ? dashboard.requestSuccessRate.toFixed(1) : 0}%
                </div>
                <p className="text-sm text-neutral-600">Request success rate</p>
              </div>
            </div>
          </div>

          {/* Notifications & Alerts */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
              <FaBell className="mr-2 text-yellow-600" />
              Notifications & Alerts
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {dashboard.totalNotifications || 0}
                </div>
                <p className="text-sm text-neutral-600">Total notifications ({selectedPeriod})</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {dashboard.unreadNotifications || 0}
                </div>
                <p className="text-sm text-neutral-600">Unread notifications</p>
              </div>
              
              <div className="text-center">
                <div className={`text-2xl font-bold mb-1 ${dashboard.systemAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {dashboard.systemAlerts || 0}
                </div>
                <p className="text-sm text-neutral-600">System alerts</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardHome;