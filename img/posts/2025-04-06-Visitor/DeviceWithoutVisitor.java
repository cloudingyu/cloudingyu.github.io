public class DeviceWithoutVisitor {
    public static void main(String[] args) {
        Computer computer = new Computer(
                new Chassis(
                        new Harddisk(),
                        new Switch("chassis")),
                new Monitor(new Switch("monitor")));

        computer.getChassis().getSwitch1().close();
        computer.getMonitor().getSwitch1().close();
    }
}

class Computer {
    private Chassis chassis;
    private Monitor monitor;

    public Computer(Chassis chassis, Monitor monitor) {
        this.chassis = chassis;
        this.monitor = monitor;
    }

    public Chassis getChassis() {
        return chassis;
    }

    public Monitor getMonitor() {
        return monitor;
    }

}

class Chassis {

    private Harddisk harddisk;
    private Switch switch1;

    public Chassis(Harddisk harddisk, Switch switch1) {
        this.harddisk = harddisk;
        this.switch1 = switch1;
    }

    public Harddisk getHarddisk() {
        return harddisk;
    }

    public Switch getSwitch1() {
        return switch1;
    }

}

class Harddisk {

}

class Monitor {

    private Switch switch1;

    public Monitor(Switch sw) {
        this.switch1 = sw;
    }

    public Switch getSwitch1() {
        return switch1;
    }

}

class Switch {
    private String name;

    public Switch(String name) {
        this.name = name;
    }

    public void close() {
        System.out.println(name + " switch closed");
    }

}
