import React from 'react';
import TableCrmMobileOrder from './components/TableCrmMobileOrder';
import { ConfigProvider } from "antd";

function App() {
    return (
    <ConfigProvider
        theme={{
            components: {
                Input: {
                    controlHeight: 40,
                },
                Select: {
                    controlHeight: 40,
                },
                Button: {
                    controlHeight: 40,
                },
            },
        }}
    >
    <TableCrmMobileOrder />;
    </ConfigProvider>
)}
export default App;