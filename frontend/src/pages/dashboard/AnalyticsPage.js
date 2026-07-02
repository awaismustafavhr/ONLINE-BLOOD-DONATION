import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { 
  FaChartLine, 
  FaChartBar, 
  FaChartPie, 
  FaChartArea, 
  FaDownload, 
  FaFilter, 
  FaCalendarAlt, 
  FaHeart, 
  FaHandHoldingHeart, 
  FaUsers, 
  FaTint, 
  FaMapMarkerAlt, 
  FaClock, 
  FaArrowUp, 
  FaArrowDown, 
  FaMinus,
  FaEye,
  FaSync
} from 'react-icons/fa';
import { useQuery } from 'react-query';
import { analyticsAPI } from '../../services/api';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';

const AnalyticsPage = () => {
  const { user, hasRole } = useAuth();
  
  // State
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [selectedChart, setSelectedChart] = useState('overview');
  const [selectedBloodType, setSelectedBloodType] = useState('all');

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading, refetch } = useQuery(
    ['analytics', { period: selectedPeriod, bloodType: selectedBloodType }],
    () => analyticsAPI.getDashboard({ 
      period: selectedPeriod,
      bloodType: selectedBloodType !== 'all' ? selectedBloodType : undefined
    }),
    {
      enabled: hasRole(['system_admin', 'medical_admin']),
    }
  );

  const analytics = analyticsData?.data?.dashboard || {};

  // Get period options
  const periodOptions = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' }
  ];

  // Get chart options
  const chartOptions = [
    { id: 'overview', label: 'Overview', icon: FaChartLine },
    { id: 'donations', label: 'Donations', icon: FaHeart },
    { id: 'requests', label: 'Requests', icon: FaHandHoldingHeart },
    { id: 'users', label: 'Users', icon: FaUsers },
    { id: 'geographic', label: 'Geographic', icon: FaMapMarkerAlt }
  ];

  // Get blood type options
  const bloodTypeOptions = [
    { value: 'all', label: 'All Blood Types' },
    { value: 'A+', label: 'A+' },
    { value: 'A-', label: 'A-' },
    { value: 'B+', label: 'B+' },
    { value: 'B-', label: 'B-' },
    { value: 'AB+', label: 'AB+' },
    { value: 'AB-', label: 'AB-' },
    { value: 'O+', label: 'O+' },
    { value: 'O-', label: 'O-' }
  ];

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

  if (analyticsLoading) {
    return <LoadingSpinner fullScreen text="Loading analytics..." />;
  }

  if (!hasRole(['system_admin', 'medical_admin'])) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <FaChartLine className="text-4xl text-neutral-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-neutral-900 mb-2">Access Denied</h2>
          <p className="text-neutral-600">You don't have permission to view analytics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Analytics Dashboard</h1>
          <p className="text-neutral-600 mt-1">
            Insights and trends for blood donation system
          </p>
        </div>
        
        <div className="flex items-center space-x-4 mt-4 sm:mt-0">
          <button 
            onClick={() => refetch()}
            className="btn btn-outline flex items-center space-x-2"
          >
            <FaSync />
            <span>Refresh</span>
          </button>
          
          <button className="btn btn-primary flex items-center space-x-2">
            <FaDownload />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Time Period
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            >
              {periodOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Blood Type
            </label>
            <select
              value={selectedBloodType}
              onChange={(e) => setSelectedBloodType(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            >
              {bloodTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Chart Type
            </label>
            <select
              value={selectedChart}
              onChange={(e) => setSelectedChart(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blood-500 focus:border-transparent"
            >
              {chartOptions.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: 'Total Donations',
            value: analytics.totalDonations || 0,
            previous: analytics.previousDonations || 0,
            icon: FaHeart,
            color: 'text-red-600',
            bgColor: 'bg-red-100'
          },
          {
            title: 'Blood Requests',
            value: analytics.totalRequests || 0,
            previous: analytics.previousRequests || 0,
            icon: FaHandHoldingHeart,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100'
          },
          {
            title: 'Active Users',
            value: analytics.activeUsers || 0,
            previous: analytics.previousUsers || 0,
            icon: FaUsers,
            color: 'text-green-600',
            bgColor: 'bg-green-100'
          },
          {
            title: 'Blood Collected',
            value: analytics.totalBloodCollected || 0,
            previous: analytics.previousBloodCollected || 0,
            icon: FaTint,
            color: 'text-purple-600',
            bgColor: 'bg-purple-100'
          }
        ].map((metric, index) => {
          const percentageChange = calculatePercentageChange(metric.value, metric.previous);
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
                <div className={`p-3 rounded-lg ${metric.bgColor}`}>
                  <metric.icon className={`text-xl ${metric.color}`} />
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
                  {metric.value.toLocaleString()}
                </p>
                <p className="text-sm text-neutral-600">{metric.title}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Chart Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <div className="flex flex-wrap gap-2">
          {chartOptions.map((chart) => (
            <button
              key={chart.id}
              onClick={() => setSelectedChart(chart.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                selectedChart === chart.id
                  ? 'bg-blood-100 text-blood-700 border border-blood-200'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              <chart.icon />
              <span>{chart.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overview Chart */}
        {selectedChart === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-neutral-200 p-6"
          >
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
              <FaChartLine className="mr-2 text-blood-600" />
              Overview Trends
            </h3>
            <div className="h-64 flex items-center justify-center bg-neutral-50 rounded-lg">
              <div className="text-center">
                <FaChartLine className="text-4xl text-neutral-400 mx-auto mb-2" />
                <p className="text-neutral-600">Chart visualization would go here</p>
                <p className="text-sm text-neutral-500">Integration with Chart.js or Recharts</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Donations Chart */}
        {selectedChart === 'donations' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6"
          >
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
              <FaHeart className="mr-2 text-red-600" />
              Donations by Blood Type
            </h3>
            <div className="h-64 flex items-center justify-center bg-neutral-50 rounded-lg">
              <div className="text-center">
                <FaChartPie className="text-4xl text-neutral-400 mx-auto mb-2" />
                <p className="text-neutral-600">Donations chart would go here</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Requests Chart */}
        {selectedChart === 'requests' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6"
          >
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
              <FaHandHoldingHeart className="mr-2 text-blue-600" />
              Requests by Urgency
            </h3>
            <div className="h-64 flex items-center justify-center bg-neutral-50 rounded-lg">
              <div className="text-center">
                <FaChartBar className="text-4xl text-neutral-400 mx-auto mb-2" />
                <p className="text-neutral-600">Requests chart would go here</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Users Chart */}
        {selectedChart === 'users' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6"
          >
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
              <FaUsers className="mr-2 text-green-600" />
              User Growth
            </h3>
            <div className="h-64 flex items-center justify-center bg-neutral-50 rounded-lg">
              <div className="text-center">
                <FaChartArea className="text-4xl text-neutral-400 mx-auto mb-2" />
                <p className="text-neutral-600">User growth chart would go here</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Geographic Chart */}
        {selectedChart === 'geographic' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-neutral-200 p-6"
          >
            <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center">
              <FaMapMarkerAlt className="mr-2 text-purple-600" />
              Geographic Distribution
            </h3>
            <div className="h-64 flex items-center justify-center bg-neutral-50 rounded-lg">
              <div className="text-center">
                <FaMapMarkerAlt className="text-4xl text-neutral-400 mx-auto mb-2" />
                <p className="text-neutral-600">Geographic map would go here</p>
                <p className="text-sm text-neutral-500">Integration with Google Maps or Mapbox</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Blood Type Distribution */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center">
          <FaTint className="mr-2 text-blood-600" />
          Blood Type Distribution
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bloodType) => {
            const count = analytics.bloodTypeDistribution?.[bloodType] || 0;
            const percentage = analytics.totalDonations > 0 ? (count / analytics.totalDonations) * 100 : 0;
            
            return (
              <div key={bloodType} className="text-center">
                <div className="text-2xl font-bold text-neutral-900 mb-1">
                  {count}
                </div>
                <div className="text-sm text-neutral-600 mb-2">
                  {bloodType}
                </div>
                <div className="w-full bg-neutral-200 rounded-full h-2">
                  <div 
                    className="bg-blood-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {percentage.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 p-6">
        <h3 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center">
          <FaClock className="mr-2 text-blood-600" />
          Recent Activity
        </h3>
        
        <div className="space-y-4">
          {analytics.recentActivity?.map((activity, index) => (
            <div key={index} className="flex items-center space-x-4 p-3 border border-neutral-200 rounded-lg">
              <div className="w-2 h-2 bg-blood-600 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900">
                  {activity.description}
                </p>
                <p className="text-xs text-neutral-500">
                  {new Date(activity.createdAt).toLocaleString()}
                </p>
              </div>
              <Badge className="bg-neutral-100 text-neutral-800">
                {activity.type}
              </Badge>
            </div>
          )) || (
            <div className="text-center py-8 text-neutral-500">
              No recent activity
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;