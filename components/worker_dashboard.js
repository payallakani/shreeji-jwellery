import React, { useEffect, useState } from 'react';
import { fetchAllItems, fetchAllSections } from '../actions/actions_creators';
import { FaEdit, FaSave, FaTimes, FaTrash, FaDownload } from 'react-icons/fa';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import moment from 'moment';
import { PAYMENT_STATUS } from '../lib/constants';

export default function PayableDashboard(props) {
  const [workDetails, setWorkDetails] = useState([]);
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);

  const [startDate, setStartDate] = useState(moment().startOf('day').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(moment().endOf('day').format('YYYY-MM-DD'));
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const response = await fetchAllSections();
        setSections(response);
      } catch (error) {
        console.error('Error fetching sections:', error);
      }
    };

    const fetchItems = async () => {
      try {
        const response = await fetchAllItems();
        setItems(response);
      } catch (error) {
        console.error('Error fetching items:', error);
      }
    };

    fetchSections();
    fetchItems();
  }, []);

  const fetchWorkDetails = async (reset = false) => {
    try {
      const payment_status = selectedPaymentStatus ? `payment_status=${selectedPaymentStatus}` : '';
      const fromDate = startDate ? `&fromDate=${startDate}` : '';
      const toDate = endDate ? `&toDate=${endDate}` : '';
      const limit = 50;
      const skip = reset ? 0 : offset;
      const response = await fetch(`/api/work_records?${payment_status}${fromDate}${toDate}&limit=${limit}&skip=${skip}`);
      const data = await response.json();

      if (reset) {
        setWorkDetails(data);
      } else {
        setWorkDetails(prevDetails => [...prevDetails, ...data]);
      }

      setHasMore(data.length === limit);
      setOffset(prevOffset => prevOffset + limit);
    } catch (error) {
      console.error('Error fetching work details:', error);
    }
  };

  useEffect(() => {
    setOffset(0);
    fetchWorkDetails(true);
  }, [selectedPaymentStatus, startDate, endDate]);

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
    console.log('Scrolling...', bottom, hasMore);
    if (bottom && hasMore) {
      console.log('Fetching more data...');
      fetchWorkDetails();
    }
  };

  const filteredWorkDetails = workDetails.filter(detail => {
    const createdAt = new Date(detail.createdAt);
    const start = new Date(startDate);

    const end = new Date(endDate);
    end?.setHours(23, 59, 59, 999);
    return (!startDate || createdAt >= start) && (!endDate || createdAt <= end);
  });

  const handleDownload = () => {
    const doc = new jsPDF();

    // Document Styles
    const mainTitleFontSize = 18;
    const sectionFontSize = 14;
    const normalFontSize = 12;
    const titleColor = [52, 73, 94]; // Darker color for the title
    const headerColor = [71, 85, 105]; // Custom blue for the header

    // Add Title, Mobile Number, and Address
    doc.setFontSize(mainTitleFontSize);
    doc.setTextColor(...titleColor);

    doc.setFontSize(normalFontSize);
    doc.setTextColor(0, 0, 0); // Black text for body
    // Add Date Range (if filters are applied)
    if (startDate || endDate) {
      doc.setFontSize(sectionFontSize);
      doc.setTextColor(100, 100, 100); // Gray color for date range text
      const dateText = `Period: ${
        startDate ? new Date(startDate).toLocaleDateString() : 'Start'
      } to ${endDate ? new Date(endDate).toLocaleDateString() : 'End'}`;
      doc.text(dateText, 14, 40);
    }

    // Prepare Table Data
    const tableData = filteredWorkDetails.map(detail => [
      detail.worker_name,
      detail.section_name,
      detail.item_name,
      detail.piece.toString(),
      `Rs. ${detail.item_rate.toFixed(2)}`,
      `Rs. ${(detail.amount ? detail.amount : detail.piece * detail.item_rate).toFixed(2)}`,
      detail.createdAt ? moment(detail.createdAt).format('DD-MM-YYYY') : '',
      detail.payment_status,
      detail.payment_date ? moment(detail.payment_date).format('DD-MM-YYYY') : '',
    ]);

    // Calculate Total Amount
    const totalAmount = filteredWorkDetails.reduce(
      (sum, detail) => sum + (detail.amount || detail.piece * detail.item_rate),
      0
    );

    // Add Total Row
    tableData.push(['Total', '', '', '', `Rs. ${totalAmount.toFixed(2)}`, '', '', '']);

    // Generate Table with Improved Design
    doc.autoTable({
      startY: startDate || endDate ? 50 : 40,
      head: [
        [
          'Name',
          'Section',
          'Item',
          'Piece',
          'Rate',
          'Amount',
          'Submitted On',
          'Payment Status',
          'Payment Date',
        ],
      ],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: headerColor,
        fontSize: normalFontSize,
        fontStyle: 'bold',
        textColor: [255, 255, 255],
      },
      bodyStyles: {
        fontSize: normalFontSize - 1,
        cellPadding: 4,
      },
      footStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      margin: { top: 20 },
      didDrawPage: data => {
        // Footer for each page with timestamp
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(
          `Page ${pageCount}`,
          doc.internal.pageSize.width - 20,
          doc.internal.pageSize.height - 10
        );
        doc.text(
          `Generated on: ${new Date().toLocaleString()}`,
          14,
          doc.internal.pageSize.height - 10
        );
      },
    });

    // Save the PDF
    doc.save(`payables${startDate}_${endDate}.pdf`);
  };

  const handleCheckboxChange = id => {
    setSelectedRecords(prevSelected =>
      prevSelected.includes(id)
        ? prevSelected.filter(recordId => recordId !== id)
        : [...prevSelected, id]
    );
  };

  const handleMarkAsPaid = () => {
    const markAsPaid = async () => {
      try {
        const response = await fetch('/api/apply_payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordIds: selectedRecords, payment_status: PAYMENT_STATUS.PAID }),
        });

        if (!response.ok) {
          throw new Error('Failed to mark records as paid');
        }

        const result = await response.json();
        setSelectedRecords([]);
        fetchWorkDetails();
        // Optionally, update the UI to reflect the change
      } catch (error) {
        console.error('Error marking records as paid:', error);
      }
    };

    markAsPaid();
    // Implement further logic for marking as paid
  };

  const handleDownloadSelected = () => {
    const doc = new jsPDF();
    const selectedDetails = workDetails.filter(detail => selectedRecords.includes(detail._id));

    // Add Worker Details

    // Prepare Table Data
    const tableData = selectedDetails.map(detail => [
      detail.worker_name,
      detail.section_name,
      detail.item_name,
      detail.piece.toString(),
      `Rs. ${detail.item_rate.toFixed(2)}`,
      `Rs. ${(detail.amount ? detail.amount : detail.piece * detail.item_rate).toFixed(2)}`,
      detail.createdAt ? moment(detail.createdAt).format('DD-MM-YYYY') : '',
      detail.payment_status,
      detail.payment_date ? moment(detail.payment_date).format('DD-MM-YYYY') : '',
    ]);

    // Calculate Total Amount for Selected Records
    const totalAmount = selectedDetails.reduce(
      (sum, detail) => sum + (detail.amount || detail.piece * detail.item_rate),
      0
    );

    // Add Total Row
    tableData.push(['Total', '', '', '', `Rs. ${totalAmount.toFixed(2)}`, '', '', '']);

    // Generate Table
    doc.autoTable({
      startY: 40,
      head: [
        [
          'Name',
          'Section',
          'Item',
          'Piece',
          'Rate',
          'Amount',
          'Submitted On',
          'Payment Status',
          'Payment Date',
        ],
      ],
      body: tableData,
      theme: 'grid',
    });

    // Save the PDF
    doc.save(
      `Selected_Records_${new Date(startDate).toLocaleDateString()}-${new Date(
        endDate
      ).toLocaleDateString()}.pdf`
    );
  };

  const totalSelectedAmount = workDetails
    .filter(detail => selectedRecords.includes(detail._id))
    .reduce((sum, detail) => sum + (detail.amount || detail.piece * detail.item_rate), 0);

  const handleSelectAllChange = e => {
    if (e.target.checked) {
      // Select all filtered work details
      const allIds = filteredWorkDetails
        .filter(d => d.payment_status !== PAYMENT_STATUS.PAID)
        .map(detail => detail._id);
      setSelectedRecords(allIds);
    } else {
      // Deselect all
      setSelectedRecords([]);
    }
  };

  const handleDownloadCSV = async () => {
    try {
      const payment_status = selectedPaymentStatus ? `payment_status=${selectedPaymentStatus}` : '';
      const fromDate = startDate ? `&fromDate=${startDate}` : '';
      const toDate = endDate ? `&toDate=${endDate}` : '';
      const response = await fetch(`/api/work_records?${payment_status}${fromDate}${toDate}`);
      const data = await response.json();

      // Convert data to CSV format
      const csvContent = [
        ['Name', 'Section', 'Item', 'Piece', 'Rate', 'Amount', 'Submitted On', 'Payment Status', 'Payment Date'],
        ...data.map(detail => [
          detail.worker_name,
          detail.section_name,
          detail.item_name,
          detail.piece.toString(),
          `Rs. ${detail.item_rate.toFixed(2)}`,
          `Rs. ${(detail.amount ? detail.amount : detail.piece * detail.item_rate).toFixed(2)}`,
          detail.createdAt ? moment(detail.createdAt).format('DD-MM-YYYY') : '',
          detail.payment_status,
          detail.payment_date ? moment(detail.payment_date).format('DD-MM-YYYY') : '',
        ])
      ].map(e => e.join(",")).join("\n");

      // Create a blob and download the CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `work_details_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading CSV:', error);
    }
  };

  return (
    <div className="flex justify-center" >
      {/* Date Filter Inputs */}

      {/* Work Details Table */}
      <div className="mt-12 bg-white shadow-lg rounded-lg  ">
        <div className="flex justify-between items-center mb-6 px-4">
          <h2 className="text-2xl font-semibold text-gray-800">All Payable Dashboard</h2>
          {filteredWorkDetails.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
                <FaDownload /> Download PDF
              </button>
              <button
                onClick={handleDownloadCSV}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                <FaDownload /> Download CSV
              </button>
            </div>
          )}
        </div>

        <div className="mb-4 mx-5">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border border-gray-300 rounded-lg p-2 mr-2"
          />
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border border-gray-300 rounded-lg p-2"
          />

          <button
            onClick={() =>
              setSelectedPaymentStatus(prev =>
                prev !== PAYMENT_STATUS.PAID ? PAYMENT_STATUS.PAID : null
              )
            }
            className={`bg-green-500 text-white font-semibold px-4 py-2 rounded-lg ml-2 hover:bg-green-600 transition ${
              selectedPaymentStatus === PAYMENT_STATUS.PAID && 'bg-blue-800 underline'
            }`}>
            Paid
          </button>
          <button
            onClick={() =>
              setSelectedPaymentStatus(prev =>
                prev !== PAYMENT_STATUS.PENDING ? PAYMENT_STATUS.PENDING : null
              )
            }
            className={`bg-red-500 text-white font-semibold px-4 py-2  ml-2 rounded-lg hover:bg-red-600 transition ${
              selectedPaymentStatus === PAYMENT_STATUS.PENDING && 'bg-blue-800 underline'
            }`}>
            Unpaid
          </button>
        </div>
        <div className="overflow-x-scroll text-wrap" style={{ maxHeight: '500px', overflowY: 'scroll' }} onScroll={handleScroll}>
          <div className="w-max bg-gray-100 p-4 font-medium text-gray-700 flex gap-4 ">
            <div className="w-20">Name</div>
            <div className="w-32">Section</div>
            <div className="w-32">Item</div>
            <div className="w-10">Piece</div>
            <div className="w-10">Rate</div>
            <div className="w-16">Amount</div>
            <div className="w-32">Submitted On</div>
            <div className="w-20">Payment Status</div>
            <div className="w-32">Payment Date</div>
          </div>
            <div>
          {filteredWorkDetails.length > 0 ? (
            <>
              {filteredWorkDetails.map(detail => (
                <div
                  key={detail._id}
                  className="w-max flex gap-4 p-4 border-b last:border-none text-gray-700">
                  <>
                    <div className="w-20">{detail.worker_name}</div>

                    <div className="w-32">{detail.section_name}</div>
                    <div className="w-32">{detail.item_name}</div>
                    <div className="w-10">{detail.piece}</div>
                    <div className="w-10">₹{detail.item_rate}</div>
                    <div className="w-16">
                      ₹
                      {detail.amount
                        ? detail.amount.toFixed(2)
                        : (detail.piece * detail.item_rate).toFixed(2)}
                    </div>
                    <div className="w-32">
                      {detail.createdAt ? moment(detail.createdAt).format('LLL') : ''}
                    </div>
                    <div className="w-20">
                      {detail.payment_status === PAYMENT_STATUS.PAID
                        ? PAYMENT_STATUS.PAID
                        : PAYMENT_STATUS.PENDING}
                    </div>
                    <div className="w-32">
                      {detail.payment_date ? moment(detail.payment_date).format('LLL') : ''}
                    </div>
                  </>
                </div>
              ))}

              {/* Add Total Row */}
              <div className="min-w-full flex p-4 border-t bg-gray-50 font-semibold">
                <div className="w-20">Total</div>
                <div className="w-32"></div>
                <div className="w-32"></div>
                <div className="w-40"></div>
                <div className="w-32">
                  ₹
                  {filteredWorkDetails
                    .reduce(
                      (sum, detail) => sum + (detail.amount || detail.piece * detail.item_rate),
                      0
                    )
                    .toFixed(2)}
                </div>
                <div className="w-40"></div>
                <div className="w-32"></div>
              </div>
            </>
          ) : (
            <div className="p-4 text-gray-500 text-center">No work details found</div>
          )}
          </div>
        </div>

        {/* Action Bar */}
        {selectedRecords.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 flex justify-between items-center">
            <div className="text-lg font-semibold">
              Total Amount: ₹{totalSelectedAmount.toFixed(2)}
            </div>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={
                    selectedRecords.length ===
                    filteredWorkDetails.filter(d => d.payment_status !== PAYMENT_STATUS.PAID).length
                  }
                  onChange={handleSelectAllChange}
                  className="mr-2"
                />
                Select All Unpaid
              </label>
              <button
                onClick={handleMarkAsPaid}
                className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                Mark As Paid
              </button>
              <button
                onClick={handleDownloadSelected}
                className="bg-green-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-green-700 transition">
                Download Selected
              </button>
              <button
                onClick={() => setSelectedRecords([])}
                className="bg-red-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-red-700 transition">
                <i className="fas fa-times"></i> Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
