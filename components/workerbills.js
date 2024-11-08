import React, { useEffect, useState } from 'react';
import { fetchAllItems, fetchAllSections } from '../actions/actions_creators';
import { FaEdit, FaSave, FaTimes, FaTrash, FaDownload } from 'react-icons/fa';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import moment from 'moment';
import { PAYMENT_STATUS } from '../lib/constants';

export default function WorkerBills(props) {
  const { selectedWorker } = props;
  const [workDetails, setWorkDetails] = useState([]);
  const [sections, setSections] = useState([]);
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [editingRow, setEditingRow] = useState(null);
  const [editData, setEditData] = useState({});
  const [newWorkDetail, setNewWorkDetail] = useState({
    section: '',
    item: '',
    piece: '',
    item_rate: '',
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedRecords, setSelectedRecords] = useState([]);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState(null);
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

  const fetchWorkDetails = async () => {
    try {
      const response = await fetch(`/api/work_records?worker=${selectedWorker._id}`);
      const data = await response.json();
      setWorkDetails(data);
    } catch (error) {
      console.error('Error fetching work details:', error);
    }
  };

  useEffect(() => {
    if (selectedWorker) fetchWorkDetails();
    else setWorkDetails([]);
  }, [selectedWorker]);

  const handleAddWorkDetail = async () => {
    const { section, item, piece, item_rate } = newWorkDetail;
    const section_name = sections.find(s => s._id === section)?.name || '';
    const item_name = items.find(i => i._id === item)?.name || '';
    const amount = Number(piece) * Number(item_rate);

    try {
      const response = await fetch('/api/work_records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          section_name,
          item,
          item_name,
          piece,
          item_rate,
          worker: selectedWorker._id,
          worker_name: selectedWorker.name,
          amount,
        }),
      });

      const newDetail = await response.json();
      setWorkDetails([...workDetails, newDetail]);
      setNewWorkDetail({ section: '', item: '', piece: '', item_rate: '' });
    } catch (error) {
      console.error('Error adding work detail:', error);
    }
  };

  const handleNewWorkDetailChange = e => {
    const { name, value } = e.target;
    setNewWorkDetail(prevData => ({ ...prevData, [name]: value }));
  };

  const handleSectionChange = e => {
    const sectionId = e.target.value;
    const selectedSection = sections.find(section => section._id === sectionId);

    setNewWorkDetail(prevData => ({
      ...prevData,
      section: sectionId,
      item: '', // Clear item when section changes
      item_rate: '',
    }));
    setFilteredItems(items.filter(item => item.section === sectionId));
  };

  const handleItemChange = e => {
    const itemId = e.target.value;
    const selectedItem = items.find(item => item._id === itemId);
    setNewWorkDetail(prevData => ({
      ...prevData,
      item: itemId,
      item_rate: selectedItem?.rate || '',
    }));
  };

  const handleEditClick = detail => {
    setEditingRow(detail._id);
    setEditData({ ...detail });
    setFilteredItems(items.filter(item => item.section === detail.section));
  };

  const handleSaveClick = async () => {
    try {
      const updatedData = {
        ...editData,
        amount: editData.piece * editData.item_rate,
      };

      const response = await fetch(`/api/work_records?id=${editingRow}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      const savedData = await response.json();

      setWorkDetails(prevWorkDetails =>
        prevWorkDetails.map(detail => (detail._id === editingRow ? savedData : detail))
      );

      setEditingRow(null);
      setEditData({});
    } catch (error) {
      console.error('Error saving work detail:', error);
    }
  };

  const handleCancelClick = () => {
    setEditingRow(null);
    setEditData({});
  };

  const handleEditChange = e => {
    const { name, value } = e.target;
    setEditData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleDeleteClick = async id => {
    try {
      await fetch(`/api/work_records?id=${id}`, { method: 'DELETE' });
      setWorkDetails(prevWorkDetails => prevWorkDetails.filter(detail => detail._id !== id));
    } catch (error) {
      console.error('Error deleting work detail:', error);
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
    doc.text(`${selectedWorker?.name} ${selectedWorker?.lastname ?? ''}`, 14, 15);

    doc.setFontSize(normalFontSize);
    doc.setTextColor(0, 0, 0); // Black text for body
    doc.text(`Mobile Number: ${selectedWorker.mobile_no}`, 14, 25);
    doc.text(`Address: ${selectedWorker.address}`, 14, 32);

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
      detail.section_name,
      detail.item_name,
      detail.piece.toString(),
      `Rs. ${detail.item_rate.toFixed(2)}`,
      `Rs. ${(detail.amount ? detail.amount : detail.piece * detail.item_rate).toFixed(2)}`,
      detail.createdAt ? moment(detail.createdAt).format('LLL') : '',
      detail.payment_status,
      detail.payment_date ? moment(detail.payment_date).format('LLL') : '',
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
    doc.save(
      `${
        selectedWorker.name + ' ' + (selectedWorker.lastname ?? '')
      }_payable_${new Date().toLocaleDateString()}.pdf`
    );
  };

  const handleCheckboxChange = id => {
    setSelectedRecords(prevSelected =>
      prevSelected.includes(id)
        ? prevSelected.filter(recordId => recordId !== id)
        : [...prevSelected, id]
    );
  };

  const handleMarkAsPaid = () => {
    console.log('Selected record IDs:', selectedRecords);
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
        console.log('Records marked as paid:', result);
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
    doc.setFontSize(18);
    doc.text(`${selectedWorker?.name} ${selectedWorker?.lastname ?? ''}`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Mobile Number: ${selectedWorker.mobile_no}`, 14, 25);
    doc.text(`Address: ${selectedWorker.address}`, 14, 32);

    // Prepare Table Data
    const tableData = selectedDetails.map(detail => [
      detail.section_name,
      detail.item_name,
      detail.piece.toString(),
      `Rs. ${detail.item_rate.toFixed(2)}`,
      `Rs. ${(detail.amount ? detail.amount : detail.piece * detail.item_rate).toFixed(2)}`,
      detail.createdAt ? moment(detail.createdAt).format('LLL') : '',
      detail.payment_status,
      detail.payment_date ? moment(detail.payment_date).format('LLL') : '',
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
      `${
        selectedWorker.name + ' ' + (selectedWorker.lastname ?? '')
      }_Selected_Records_${new Date().toLocaleDateString()}.pdf`
    );
  };

  const totalSelectedAmount = workDetails
    .filter(detail => selectedRecords.includes(detail._id))
    .reduce((sum, detail) => sum + (detail.amount || detail.piece * detail.item_rate), 0);

  return (
    <div className="container mx-auto p-4">
      {/* Date Filter Inputs */}

      {selectedWorker && (
        <div className="bg-white shadow-lg rounded-lg p-4 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Add Work Detail</h2>
          <div className="flex flex-col md:flex-row gap-4">
            <select
              name="section"
              value={newWorkDetail.section}
              onChange={handleSectionChange}
              className="border border-gray-300 rounded-lg p-2">
              <option value="">Select Section</option>
              {sections.map(section => (
                <option key={section._id} value={section._id}>
                  {section.name}
                </option>
              ))}
            </select>

            <select
              name="item"
              value={newWorkDetail.item}
              onChange={handleItemChange}
              className="border border-gray-300 rounded-lg p-2">
              <option value="">Select Item</option>
              {filteredItems.map(item => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>

            <input
              type="number"
              name="piece"
              placeholder="Enter pieces"
              value={newWorkDetail.piece}
              onChange={handleNewWorkDetailChange}
              className="border border-gray-300 rounded-lg p-2"
            />

            <input
              type="number"
              name="item_rate"
              placeholder="Enter rate"
              value={newWorkDetail.item_rate}
              onChange={handleNewWorkDetailChange}
              className="border border-gray-300 rounded-lg p-2"
            />

            <button
              onClick={handleAddWorkDetail}
              className="bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Work Details Table */}
      <div className="mt-12 bg-white shadow-lg rounded-lg mx-auto max-w-4xl">
        <div className="flex justify-between items-center mb-6 px-4">
          <h2 className="text-2xl font-semibold text-gray-800">Work Details</h2>
          {filteredWorkDetails.length > 0 && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
              <FaDownload /> Download PDF
            </button>
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
            className="bg-green-500 text-white font-semibold px-4 py-2 rounded-lg ml-2 hover:bg-green-600 transition">
            Paid
          </button>
          <button
            onClick={() =>
              setSelectedPaymentStatus(prev =>
                prev !== PAYMENT_STATUS.PENDING ? PAYMENT_STATUS.PENDING : null
              )
            }
            ß
            className="bg-red-500 text-white font-semibold px-4 py-2  ml-2 rounded-lg hover:bg-red-600 transition">
            Unpaid
          </button>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-full bg-gray-100 p-4 font-medium text-gray-700 grid grid-cols-10 gap-4">
            <div>Select</div>
            <div>Section</div>
            <div>Item</div>
            <div>Piece</div>
            <div>Rate</div>
            <div>Amount</div>
            <div>Submitted On</div>
            <div>Payment Status</div>
            <div>Payment Date</div>
            <div colSpan="2">Actions</div>
          </div>

          {filteredWorkDetails.length > 0 ? (
            <>
              {filteredWorkDetails.map(detail => (
                <div
                  key={detail._id}
                  className="min-w-full grid grid-cols-10 gap-4 p-4 border-b last:border-none text-gray-700">
                  {editingRow === detail._id && detail.payment_status !== PAYMENT_STATUS.PAID ? (
                    <>
                      {/* Editable Dropdown for Section */}
                      <select
                        name="section"
                        value={editData.section}
                        onChange={e => {
                          const sectionId = e.target.value;
                          const selectedSection = sections.find(
                            section => section._id === sectionId
                          );
                          setEditData(prevData => ({
                            ...prevData,
                            section: sectionId,
                            section_name: selectedSection ? selectedSection.name : '',
                            item: '',
                            item_name: '',
                          }));
                          setFilteredItems(items.filter(item => item.section === sectionId));
                        }}
                        className="border border-gray-300 rounded-lg p-2">
                        <option value="">Select Section</option>
                        {sections.map(section => (
                          <option key={section._id} value={section._id}>
                            {section.name}
                          </option>
                        ))}
                      </select>

                      {/* Editable Dropdown for Item */}
                      <select
                        name="item"
                        value={editData.item}
                        onChange={e => {
                          const itemId = e.target.value;
                          const selectedItem = items.find(item => item._id === itemId);
                          setEditData(prevData => ({
                            ...prevData,
                            item: itemId,
                            item_name: selectedItem ? selectedItem.name : '',
                            item_rate: selectedItem ? selectedItem.rate : 0,
                            amount: selectedItem ? selectedItem.rate * editData.piece : 0,
                          }));
                        }}
                        className="border border-gray-300 rounded-lg p-2">
                        <option value="">Select Item</option>
                        {filteredItems.map(item => (
                          <option key={item._id} value={item._id}>
                            {item.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        name="piece"
                        value={editData.piece}
                        onChange={handleEditChange}
                        className="border border-gray-300 rounded-lg p-2"
                      />
                      <input
                        type="number"
                        name="item_rate"
                        value={editData.item_rate}
                        onChange={handleEditChange}
                        className="border border-gray-300 rounded-lg p-2"
                      />
                      <div>₹{(editData.piece * editData.item_rate).toFixed(2)}</div>

                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveClick}
                          className="p-2 hover:bg-gray-100 rounded-full cursor-pointer">
                          <FaSave className="w-5 h-5 text-green-500 hover:text-green-600" />
                        </button>
                        <button
                          onClick={handleCancelClick}
                          className="p-2 hover:bg-gray-100 rounded-full cursor-pointer">
                          <FaTimes className="w-5 h-5 text-red-500 hover:text-red-600" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        checked={selectedRecords.includes(detail._id)}
                        onChange={() => handleCheckboxChange(detail._id)}
                        className="self-center"
                        disabled={detail.payment_status === PAYMENT_STATUS.PAID}
                      />
                      <div>{detail.section_name}</div>
                      <div>{detail.item_name}</div>
                      <div>{detail.piece}</div>
                      <div>₹{detail.item_rate}</div>
                      <div>
                        ₹
                        {detail.amount
                          ? detail.amount.toFixed(2)
                          : (detail.piece * detail.item_rate).toFixed(2)}
                      </div>
                      <div>{detail.createdAt ? moment(detail.createdAt).format('LLL') : ''}</div>
                      <div>{detail.payment_status}</div>
                      <div>
                        {detail.payment_date ? moment(detail.payment_date).format('LLL') : ''}
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditClick(detail)}
                          disabled={detail.payment_status === PAYMENT_STATUS.PAID}
                          className="p-2 hover:bg-gray-100 rounded-full cursor-pointer">
                          <FaEdit className="w-5 h-5 text-blue-500 hover:text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(detail._id)}
                          className="p-2 hover:bg-gray-100 rounded-full cursor-pointer">
                          <FaTrash className="w-5 h-5 text-red-500 hover:text-red-600" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Add Total Row */}
              <div className="min-w-full grid grid-cols-8 gap-4 p-4 border-t bg-gray-50 font-semibold">
                <div>Total</div>
                <div></div>
                <div></div>
                <div></div>
                <div>
                  ₹
                  {filteredWorkDetails
                    .reduce(
                      (sum, detail) => sum + (detail.amount || detail.piece * detail.item_rate),
                      0
                    )
                    .toFixed(2)}
                </div>
                <div></div>
                <div></div>
              </div>
            </>
          ) : (
            <div className="p-4 text-gray-500 text-center">No work details found</div>
          )}
        </div>

        {/* Action Bar */}
        {selectedRecords.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 flex justify-between items-center">
            <div className="text-lg font-semibold">
              Total Amount: ₹{totalSelectedAmount.toFixed(2)}
            </div>
            <div className="flex space-x-4">
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
