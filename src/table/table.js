import React, { useEffect } from 'react';
import Chart from 'react-apexcharts';
import * as echarts from 'echarts';

const Dashboard = () => {
  useEffect(() => {
    // Initialize ECharts instance
    const trafficChart = echarts.init(document.querySelector("#trafficChart"));

    // Set ECharts options
    trafficChart.setOption({
      tooltip: {
        trigger: 'item'
      },
      legend: {
        top: '5%',
        left: 'center'
      },
      series: [{
        name: 'Access From',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: '18',
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: 1048, name: 'advance 4t -' },
          { value: 735, name: 'advance -' },
          { value: 580, name: 'Email' },
          { value: 484, name: 'Union Ads' },
          { value: 300, name: ' Ads' }
        ]
      }]
    });

    // Cleanup function to dispose the chart when component unmounts
    return () => {
      trafficChart.dispose();
    };
  }, []);

  const reportsChartOptions = {
    series: [{
      name: 'Fema Deiesel Station',
      data: [31, 40, 28, 51, 42, 82, 56],
    }, {
      name: 'Wilcon Builders',
      data: [11, 32, 45, 32, 34, 52, 41]
    }, {
      name: 'Rvl Evangelista Commercial',
      data: [14, 11, 32, 28, 9, 24, 41]
    }, {
      name: 'Mortor up Auto Supply & Gen. MDSE',
      data: [16, 11, 32, 18, 9, 24, 15]
    }, {
      name: 'Christopher cycle parts',
      data: [35, 11, 32, 38, 9, 24, 11]
    }],
    chart: {
      height: 350,
      type: 'area',
      toolbar: {
        show: false
      },
    },
    markers: {
      size: 4
    },
    colors: ['#4154f1', '#2eca6a', '#ff771d', '#ff371d', '#ff271d'],
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.3,
        opacityTo: 0.4,
        stops: [0, 90, 100]
      }
    },
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 2
    },
    xaxis: {
      type: 'datetime',
      categories: ["2018-09-19T00:00:00.000Z", "2018-09-19T01:30:00.000Z", "2018-09-19T02:30:00.000Z", "2018-09-19T03:30:00.000Z", "2018-09-19T04:30:00.000Z", "2018-09-19T05:30:00.000Z", "2018-09-19T06:30:00.000Z"]
    },
    tooltip: {
      x: {
        format: 'dd/MM/yy HH:mm'
      },
    }
  };

  return (
    <main id="main" className="main">
      <div className="pagetitle">
        <h1>Dashboard</h1>
        <nav>
          <ol className="breadcrumb">
            <li className="breadcrumb-item"><a href="index.html">Home</a></li>
            <li className="breadcrumb-item active">Dashboard</li>
          </ol>
        </nav>
      </div>
      <section className="section dashboard">
        <div className="row">
          <div className="col-lg-8">
            <div className="row">
              <div className="col-12">
                <div className="card">
                  <div className="filter">
                    <a className="icon" href="#" data-bs-toggle="dropdown"><i className="bi bi-three-dots"></i></a>
                    <ul className="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
                      <li className="dropdown-header text-start">
                        <h6>Filter</h6>
                      </li>
                      <li><a className="dropdown-item" href="#">Today</a></li>
                      <li><a className="dropdown-item" href="#">This Month</a></li>
                      <li><a className="dropdown-item" href="#">This Year</a></li>
                    </ul>
                  </div>
                  <div className="card-body">
                    <h5 className="card-title">TOP 10 sales By <span>/Today</span></h5>
                    <div id="reportsChart">
                      <Chart options={reportsChartOptions} series={reportsChartOptions.series} type="area" height={350} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="card">
              <div className="filter">
                <a className="icon" href="#" data-bs-toggle="dropdown"><i className="bi bi-three-dots"></i></a>
                <ul className="dropdown-menu dropdown-menu-end dropdown-menu-arrow">
                  <li className="dropdown-header text-start">
                    <h6>Filter</h6>
                  </li>
                  <li><a className="dropdown-item" href="#">Today</a></li>
                  <li><a className="dropdown-item" href="#">This Month</a></li>
                  <li><a className="dropdown-item" href="#">This Year</a></li>
                </ul>
              </div>
              <div className="card-body">
                <h5 className="card-title">Top 10 sales By <span>/Today</span></h5>
                <div id="trafficChart" style={{ height: '400px' }}></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Dashboard;
